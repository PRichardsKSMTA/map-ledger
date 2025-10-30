import { Request, Response } from 'express';
import { listDatapointConfigurations } from '../../repositories/datapointConfigurationRepository';

export default async function listDatapointConfigs(req: Request, res: Response) {
  try {
    const emailParam = req.query.email ?? req.headers['x-user-email'];
    const clientIdParam = req.query.clientId ?? req.query.client_id;

    const email =
      typeof emailParam === 'string'
        ? emailParam.trim()
        : Array.isArray(emailParam)
        ? emailParam[0]
        : null;

    if (!email) {
      res.status(400).json({ message: 'Missing email query parameter' });
      return;
    }

    const clientId =
      typeof clientIdParam === 'string'
        ? clientIdParam.trim()
        : Array.isArray(clientIdParam)
        ? clientIdParam[0]
        : undefined;

    const configs = await listDatapointConfigurations(email.toLowerCase(), clientId);
    res.json({ items: configs });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to load datapoint configurations', error);
    res.status(500).json({ message: 'Failed to load datapoint configurations' });
  }
}
