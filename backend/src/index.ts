import 'reflect-metadata'
import express from 'express';
import industries from './functions/industries';
import masterclients from './functions/masterclients';
import glUpload from './functions/glUpload';
import mappingSuggest from './functions/mappingSuggest';
import userClients from './functions/userClients';
import listDatapointConfigs from './functions/datapointConfigs/list';
import createDatapointConfigs from './functions/datapointConfigs/create';
import updateDatapointConfigs from './functions/datapointConfigs/update';
import openApiSpec from './openapi';

const app = express();

app.use(express.json({ limit: '1mb' }));

app.get('/industries', industries);
app.get('/masterclients', masterclients);
app.post('/gl/upload', glUpload);
app.get('/mapping/suggest', mappingSuggest);
app.get('/user-clients', userClients);
app.get('/datapoint-configs', listDatapointConfigs);
app.post('/datapoint-configs', createDatapointConfigs);
app.put('/datapoint-configs/:id?', updateDatapointConfigs);

export { app, openApiSpec };
export default app;
