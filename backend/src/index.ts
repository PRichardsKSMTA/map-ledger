import 'reflect-metadata'
import express from 'express';
import industries from './functions/industries';
import masterclients from './functions/masterclients';
import glUpload from './functions/glUpload';
import mappingSuggest from './functions/mappingSuggest';
import openApiSpec from './openapi';

const app = express();

app.get('/industries', industries);
app.get('/masterclients', masterclients);
app.post('/gl/upload', glUpload);
app.get('/mapping/suggest', mappingSuggest);

export { app, openApiSpec };
export default app;
