// generate-env.js - Gera env.js a partir das variáveis de ambiente (Vercel / CI)
const fs = require('fs');

const url = process.env.VITE_SUPABASE_URL || '';
const key = process.env.VITE_SUPABASE_ANON_KEY || '';
const sst = process.env.VITE_SST_APP_URL || 'https://sst.amengenhariaseg.com.br';

if (!url || !key) {
  console.warn('[generate-env] AVISO: VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY nao definidos.');
}

const content = `// Gerado automaticamente pelo build - NAO EDITAR MANUALMENTE
window.__CONFIG = {
  SUPABASE_URL: ${JSON.stringify(url)},
  SUPABASE_ANON_KEY: ${JSON.stringify(key)},
  SST_APP_URL: ${JSON.stringify(sst)}
};
`;

fs.writeFileSync('env.js', content, 'utf8');
console.log('[generate-env] env.js gerado com sucesso.');
