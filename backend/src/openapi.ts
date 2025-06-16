const openApiSpec = {
  openapi: '3.0.0',
  info: {
    title: 'MapLedger API',
    version: '0.1.0'
  },
  paths: {
    '/industries': {
      get: { summary: 'List industries' }
    },
    '/masterclients': {
      get: { summary: 'List master clients' }
    },
    '/gl/upload': {
      post: { summary: 'Upload GL file' }
    },
    '/mapping/suggest': {
      get: { summary: 'Suggest account mapping' }
    }
  }
};

export default openApiSpec;
