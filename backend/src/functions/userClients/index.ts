import { Request, Response } from 'express';
import { fetchUserClientAccess } from '../../repositories/userClientRepository';
import { getFirstStringValue } from '../../utils/requestParsers';

export default async function userClients(req: Request, res: Response) {
  try {
    const emailParam = req.query.email ?? req.headers['x-user-email'];
    const email = getFirstStringValue(emailParam);

    if (!email) {
      res.status(400).json({ message: 'Missing email query parameter' });
      return;
    }

    const data = await fetchUserClientAccess(email.toLowerCase());
    res.json(data);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to load user clients', error);
    res.status(500).json({ message: 'Failed to load clients for user' });
  }
}
