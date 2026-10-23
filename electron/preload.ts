import { contextBridge } from 'electron';

// No privileged operations or Python entry points are exposed in Milestone 1.
contextBridge.exposeInMainWorld('villageDesktop', Object.freeze({ version: '0.1.0' }));
