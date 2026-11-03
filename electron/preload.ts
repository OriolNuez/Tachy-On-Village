import { messagingChannels, type MessagingAPI } from '../shared/messaging';
import { previewChannels, type SalesforcePreviewAPI } from '../shared/salesforce-preview';
import { contextBridge, ipcRenderer } from 'electron';
import { cadenceChannels, type CadenceAPI } from '../shared/cadences';
import { jobChannels, type JobsAPI, type JobSnapshot } from '../shared/jobs';

const cadences: CadenceAPI = {
  edit: (name, change) => ipcRenderer.invoke(cadenceChannels.edit, name, change),
  list: () => ipcRenderer.invoke(cadenceChannels.list),
  create: name => ipcRenderer.invoke(cadenceChannels.create, name),
  read: name => ipcRenderer.invoke(cadenceChannels.read, name),
  calendar: () => ipcRenderer.invoke(cadenceChannels.calendar),
  openSalesforceLink: url => ipcRenderer.invoke(cadenceChannels.openSalesforceLink, url),
};
const jobs: JobsAPI = {
  outlookHistory: cadence => ipcRenderer.invoke(jobChannels.outlookHistory, cadence),
  previewOutlook: (cadence, settings) => ipcRenderer.invoke(jobChannels.previewOutlook, cadence, settings),
  startOutlook: (cadence, token) => ipcRenderer.invoke(jobChannels.startOutlook, cadence, token),
  startCognism: cadence => ipcRenderer.invoke(jobChannels.startCognism, cadence),
  startSalesforce: cadence => ipcRenderer.invoke(jobChannels.start, cadence),
  current: () => ipcRenderer.invoke(jobChannels.current),
  act: (id, action) => ipcRenderer.invoke(jobChannels.action, id, action),
  onUpdate: listener => {
    const handler = (_event: Electron.IpcRendererEvent, job: JobSnapshot) => listener(job);
    ipcRenderer.on(jobChannels.update, handler);
    return () => ipcRenderer.removeListener(jobChannels.update, handler);
  },
};
const salesforcePreview: SalesforcePreviewAPI = {
  open: () => ipcRenderer.invoke(previewChannels.open),
  close: () => ipcRenderer.invoke(previewChannels.close),
  status: () => ipcRenderer.invoke(previewChannels.status),
  openChrome: () => ipcRenderer.invoke(previewChannels.chrome),
};
const messaging: MessagingAPI = {
  list: () => ipcRenderer.invoke(messagingChannels.list),
  read: filename => ipcRenderer.invoke(messagingChannels.read, filename),
};
contextBridge.exposeInMainWorld('villageDesktop', Object.freeze({ version: '0.1.0', cadences, jobs, salesforcePreview, messaging }));
