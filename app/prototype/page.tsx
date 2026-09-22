import type { Metadata } from 'next';
import { entryMetadata } from '../search/metadata';
import { BrandStructuredData } from '@/components/brand-structured-data';
import { Prototype } from './prototype-flow';
import './prototype.css';
import './next-version.css';

export const metadata: Metadata = entryMetadata('home', 'home');

export default function PrototypePage() {
  return <><BrandStructuredData locale="zh" page="home" /><Prototype /></>;
}
