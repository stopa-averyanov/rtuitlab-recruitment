import pg from 'pg'
import { config } from 'node-config-ts'

const { Pool } = pg;
export const pool = new Pool({...config.db});