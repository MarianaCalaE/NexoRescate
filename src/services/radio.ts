import { db, uid, addLog } from './db';
import type { LoraMessage } from '../types';
import { byteLength } from './compact';
import { haversineKm } from '../data/places';

/**
 * Capa desacoplada de radio. Implementaciones previstas:
 *  - SimulatedMeshtasticTransport (este archivo): demo, sin hardware.
 *  - MeshtasticGatewayTransport (futuro): HTTP/WebSocket hacia un servicio local en
 *    Python (`meshtastic` CLI/SDK) conectado al nodo por USB‑serial o BLE.
 *  - WebSerialTransport (futuro): solo en navegadores con Web Serial y firmware compatible.
 * El navegador NO accede directamente al hardware LoRa en este MVP.
 */
export interface NodeInfo {
  id: string;
  longName: string;
  shortName: string;
  hw: string;
  firmware: string;
  battery: number;
  channel: string;
  neighbors: number;
  snr: number;
  distanceKm?: number | null;
}

export type RadioStatus = 'desconectado' | 'conectando' | 'conectado' | 'error';

/** Nodos comunitarios FICTICIOS de la red de radio para la demostración. */
export interface MeshNode {
  id: string;
  name: string;
  lat: number;
  lng: number;
  neighbors: number;
}
export const MESH_NODES: MeshNode[] = [
  { id: '!q01c', name: 'Nodo comunitario Quibdó centro', lat: 5.6925, lng: -76.6585, neighbors: 4 },
  { id: '!q02k', name: 'Nodo barrio Kennedy', lat: 5.6975, lng: -76.6455, neighbors: 3 },
  { id: '!q03h', name: 'Nodo Hospital San Francisco', lat: 5.6896, lng: -76.6513, neighbors: 4 },
  { id: '!t01u', name: 'Nodo Tutunendo', lat: 5.7442, lng: -76.5367, neighbors: 2 },
  { id: '!y01a', name: 'Nodo Yuto', lat: 5.5311, lng: -76.6394, neighbors: 2 },
  { id: '!i01s', name: 'Nodo Istmina', lat: 5.1603, lng: -76.6847, neighbors: 3 },
  { id: '!t02d', name: 'Nodo Tadó', lat: 5.2655, lng: -76.5606, neighbors: 2 },
  { id: '!b01s', name: 'Nodo Bahía Solano', lat: 6.2224, lng: -77.4031, neighbors: 2 },
  { id: '!n01q', name: 'Nodo Nuquí', lat: 5.7097, lng: -77.2714, neighbors: 1 },
  { id: '!r01s', name: 'Nodo Riosucio', lat: 7.4403, lng: -77.1186, neighbors: 1 },
];
/** Alcance simulado para encontrar un nodo cercano. */
export const MESH_RANGE_KM = 15;

export function nearestNodes(lat: number, lng: number) {
  return MESH_NODES.map((n) => ({ node: n, km: haversineKm(lat, lng, n.lat, n.lng) }))
    .filter((x) => x.km <= MESH_RANGE_KM)
    .sort((a, b) => a.km - b.km);
}

export interface RadioTransport {
  readonly kind: 'simulado' | 'gateway' | 'webserial';
  readonly simulated: boolean;
  readonly maxPayloadBytes: number;
  status(): RadioStatus;
  node(): NodeInfo | null;
  connect(node?: MeshNode, km?: number): Promise<NodeInfo>;
  disconnect(): Promise<void>;
  send(incidentId: string, payload: string): Promise<LoraMessage>;
  onUpdate(cb: (m: LoraMessage) => void): () => void;
}

class SimulatedMeshtasticTransport implements RadioTransport {
  readonly kind = 'simulado' as const;
  readonly simulated = true;
  readonly maxPayloadBytes = 228;
  private st: RadioStatus = 'desconectado';
  private info: NodeInfo | null = null;
  private listeners = new Set<(m: LoraMessage) => void>();

  status() {
    return this.st;
  }
  node() {
    return this.info;
  }
  async connect(target?: MeshNode, km?: number) {
    this.st = 'conectando';
    await new Promise((r) => setTimeout(r, 900));
    const t = target ?? MESH_NODES[0];
    this.info = {
      id: t.id,
      longName: t.name,
      shortName: t.id.slice(1, 5).toUpperCase(),
      distanceKm: km ?? null,
      hw: 'Simulado (sin hardware)',
      firmware: 'demo-2.x',
      battery: 87,
      channel: 'NexoRescate-Demo',
      neighbors: t.neighbors,
      snr: km != null ? Math.max(-12, +(9 - km * 1.2).toFixed(1)) : 6.5,
    };
    this.st = 'conectado';
    await addLog('lora', `Conectado a ${t.name} (simulado)`);
    return this.info;
  }
  async disconnect() {
    this.st = 'desconectado';
    this.info = null;
    await addLog('lora', 'Nodo ficticio desconectado');
  }
  onUpdate(cb: (m: LoraMessage) => void) {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }
  private emit(m: LoraMessage) {
    this.listeners.forEach((l) => l(m));
  }
  async send(incidentId: string, payload: string) {
    if (this.st !== 'conectado') throw new Error('No hay un nodo conectado');
    const bytes = byteLength(payload);
    if (bytes > this.maxPayloadBytes) throw new Error(`Mensaje de ${bytes} B supera el máximo de ${this.maxPayloadBytes} B`);
    const d = await db();
    const msg: LoraMessage = { id: uid('LR'), incidentId, payload, bytes, direction: 'tx', at: Date.now(), status: 'en_cola', simulated: true };
    await d.put('lora', msg);
    this.emit({ ...msg });
    await addLog('lora', `${msg.id} en cola del nodo ficticio (${bytes} B)`, incidentId);

    setTimeout(async () => {
      msg.status = 'entregado_al_nodo';
      await d.put('lora', msg);
      this.emit({ ...msg });
    }, 700);

    setTimeout(async () => {
      // 85 % de las veces se simula ACK de un nodo vecino; si no, queda sin ACK.
      if (Math.random() < 0.85) {
        msg.status = 'ack_simulado';
        msg.ackAt = Date.now();
        msg.hops = 1 + Math.floor(Math.random() * 3);
        await addLog('lora', `${msg.id} confirmación SIMULADA recibida (${msg.hops} saltos)`, incidentId);
        const rx: LoraMessage = {
          id: uid('LR'),
          incidentId,
          payload: `ACK|${msg.id}|${incidentId}`,
          bytes: 24,
          direction: 'rx',
          at: Date.now(),
          status: 'ack_simulado',
          simulated: true,
          hops: msg.hops,
        };
        await d.put('lora', rx);
        this.emit(rx);
      } else {
        msg.status = 'sin_ack';
        await addLog('lora', `${msg.id} sin confirmación (simulado). Puede reintentarse.`, incidentId);
      }
      await d.put('lora', msg);
      this.emit({ ...msg });
    }, 2600 + Math.random() * 1200);

    return msg;
  }
}

export const radio: RadioTransport = new SimulatedMeshtasticTransport();

export async function getLoraMessages() {
  const all = await (await db()).getAllFromIndex('lora', 'at');
  return all.reverse();
}
