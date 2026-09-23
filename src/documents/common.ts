import { createHash } from 'node:crypto';
import { caseFold } from 'unicode-case-folding';
export const hash = (text: string): string => createHash('sha256').update(text).digest('hex');
export const normalizeName = (name: string): string => caseFold(name).replace(/[ _]/g, '');
export const component = (value: string): string => encodeURIComponent(value).replace(/%3A/gi, ':');
export const addressPath = (value: string): string => value.split('/').map(component).join('/');
export const slash = (path: string): string => path.replaceAll('\\', '/').replace(/^\.\//, '');
export const populationHash = (ids: string[]): string => hash([...new Set(ids)].sort().join('\n'));
