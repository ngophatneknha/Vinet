import type { NextConfig } from 'next';
import {buildRequestOrigins} from './lib/request-origin';

const nextConfig: NextConfig = {
 // Public URLs only: inline build-time metadata because function runtime may
 // not receive Netlify's read-only build environment variables.
 env:{VINEWS_REQUEST_ORIGINS:JSON.stringify(buildRequestOrigins(process.env))},
};

export default nextConfig;
