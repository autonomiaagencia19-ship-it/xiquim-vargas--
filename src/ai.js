import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { STORAGE, one } from './db.js';

let readOnlyDb = null;

/**
 * Retorna conexão dedicada e estritamente SOMENTE-LEITURA com o SQLite.
 * Travas inbypassáveis a nível de engine C do SQLite (SQLITE_OPEN_READONLY):
 * Qualquer comando de escrita disparará 'attempt to write a readonly database'.
 */
export function getAiReadOnlyDb() {
  if (!readOnlyDb) {
    const dbPath = path.join(STORAGE, 'xiquim-vargas.db');
    readOnlyDb = new DatabaseSync(dbPath, { readOnly: true });
    try {
      readOnlyDb.exec('PRAGMA busy_timeout=5000;');
    } catch {}
  }
  return readOnlyDb;
}

/**
 * Obtém o esquema completo do banco de dados (todas as tabelas e colunas),
 * ocultando colunas sensíveis como senhas e tokens.
 */
export function getSchemaDescription() {
  try {
    const db = getAiReadOnlyDb();
    const tables = db.prepare(`
      SELECT name, sql 
      FROM sqlite_master 
      WHERE type='table' 
        AND name NOT LIKE 'sqlite_%'
        AND name NOT LIKE 'idempotency_%'
      ORDER BY name
    `).all();

    return tables.map(t => {
      // Mascarar definições de senha_hash da exibição do esquema
      let cleanSql = (t.sql || '').replace(/senha_hash\s+TEXT[^,]*,?/gi, '');
      return cleanSql.trim();
    }).filter(Boolean).join('\n\n');
  } catch (err) {
    return 'Esquema padrão: produtos, estoque, clientes, pedidos, pedido_itens, usuarios, rotas_logistica, fornecedores.';
  }
}

/**
 * Executa uma consulta SQL com múltiplas travas inbypassáveis:
 * 1. Verificação léxica e regex contra comandos de mutação (INSERT, UPDATE, DELETE, etc.).
 * 2. Bloqueio contra encadeamento de instruções múltiplas (ponto e vírgula).
 * 3. Restrição exclusiva a SELECT ou WITH (Common Table Expressions).
 * 4. Limite de paginação forçado (LIMIT 100) para evitar estouro de memória.
 * 5. Sanitização automática de colunas sensíveis no resultado.
 * 6. Execução em conexão DatabaseSync aberta em { readOnly: true }.
 */
export function executeReadOnlyQuery(rawSql) {
  if (!rawSql || typeof rawSql !== 'string') {
    throw new Error('Consulta SQL inválida ou vazia.');
  }

  // Normalizar consulta
  const sql = rawSql.trim().replace(/;+\s*$/, '').trim();

  // Trava 1: Proibir encadeamento com ';'
  if (sql.includes(';')) {
    throw new Error('Trava inbypassável de segurança: múltiplas instruções SQL não são permitidas.');
  }

  // Trava 2: Proibir palavras-chave perigosas ou mutacionais
  const forbiddenKeywords = /\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|REPLACE|TRUNCATE|ATTACH|DETACH|PRAGMA|VACUUM|REINDEX|GRANT|REVOKE|UPSERT)\b/i;
  if (forbiddenKeywords.test(sql)) {
    throw new Error('Trava inbypassável de segurança: operações de escrita ou estruturais são terminantemente proibidas.');
  }

  // Trava 3: Exigir SELECT ou WITH
  if (!/^(SELECT|WITH)\b/i.test(sql)) {
    throw new Error('Trava inbypassável de segurança: apenas consultas de leitura (SELECT) são permitidas.');
  }

  // Trava 4: Limitar resultado para no máximo 100 registros
  let finalSql = sql;
  if (!/\bLIMIT\s+\d+/i.test(sql)) {
    finalSql = `${sql} LIMIT 100`;
  }

  const db = getAiReadOnlyDb();
  const stmt = db.prepare(finalSql);
  const rows = stmt.all();

  // Trava 5: Redigir qualquer campo sensível caso retornado
  return rows.map(row => {
    const cleanRow = { ...row };
    for (const key of Object.keys(cleanRow)) {
      if (/senha|password|hash|token|secret/i.test(key)) {
        cleanRow[key] = '[DADO_SENSIVEL_RESTRITO]';
      }
    }
    return cleanRow;
  });
}

/**
 * Estatísticas determinísticas básicas do sistema para fallback e compatibilidade.
 */
export function getDeterministicStats() {
  return {
    estoqueCritico: one("SELECT COUNT(*) n FROM estoque WHERE quantidade_disponivel<=estoque_minimo")?.n || 0,
    pedidosPendentes: one("SELECT COUNT(*) n FROM pedidos WHERE cancelled_at IS NULL AND status='PENDENTE'")?.n || 0,
    faturamentoConcluido: one("SELECT COALESCE(SUM(total),0) n FROM pedidos WHERE cancelled_at IS NULL AND status='CONCLUIDO'")?.n || 0
  };
}

/**
 * Obtém as configurações do Groq (chave e modelo).
 */
export function getGroqConfig() {
  const envKey = process.env.GROQ_API_KEY || '';
  const dbKeyRow = one("SELECT valor FROM configuracoes WHERE chave='groq.api_key'");
  const apiKey = (envKey || dbKeyRow?.valor || '').trim();

  const envModel = process.env.GROQ_MODEL || '';
  const dbModelRow = one("SELECT valor FROM configuracoes WHERE chave='groq.model'");
  const model = (envModel || dbModelRow?.valor || 'openai/gpt-oss-120b').trim();

  return { apiKey, model };
}

/**
 * Consulta a IA Administrativa via Groq Cloud API com o modelo gpt-oss-120b.
 * Suporta tool calling para permitir que a IA consulte qualquer tabela do banco.
 */
export async function askAdministrativeAI(userMessage) {
  const stats = getDeterministicStats();
  const deterministicPrefix = `Contexto determinístico do ERP: ${stats.estoqueCritico} produtos em estoque crítico, ${stats.pedidosPendentes} pedidos pendentes e R$ ${Number(stats.faturamentoConcluido).toFixed(2)} faturados em pedidos concluídos.`;

  const { apiKey, model } = getGroqConfig();

  if (!apiKey) {
    return {
      configured: false,
      model,
      answer: `${deterministicPrefix}\n\n[Groq não configurado]: Para ativar a análise inteligente de todo o banco de dados via modelo ${model}, informe sua GROQ_API_KEY no arquivo .env ou em Configurações (chave 'groq.api_key').\nPergunta recebida: ${String(userMessage || '')}`,
      queries: []
    };
  }

  const schema = getSchemaDescription();

  const systemPrompt = `Você é o Assistente Administrativo e Auditor de Inteligência do ERP Xiquim Vargas.
Você tem permissão para analisar TODO o banco de dados do ERP para responder dúvidas comerciais, operacionais, financeiras, logísticas e de estoque.

SEGURANÇA E TRAVAS INBYPASSÁVEIS:
1. Você opera em ambiente 100% SOMENTE LEITURA. A conexão com o banco rejeita qualquer escrita física.
2. Para consultar dados específicos, utilize SEMPRE a ferramenta "executar_consulta_sql".
3. Gere apenas consultas SQL padrão SQLite de leitura (SELECT).
4. Jamais exponha dados de senhas ou credenciais de usuários.
5. Seja direto, forneça números exatos, insights analíticos e sugestões práticas de gestão.

ESQUEMA DO BANCO DE DADOS:
${schema}
`;

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: String(userMessage || 'Resumo geral do sistema') }
  ];

  const tools = [
    {
      type: 'function',
      function: {
        name: 'executar_consulta_sql',
        description: 'Executa uma consulta SQL SELECT de leitura segura no banco de dados SQLite do ERP para obter métricas, relatórios e dados reais.',
        parameters: {
          type: 'object',
          properties: {
            sql: {
              type: 'string',
              description: 'Query SQL SELECT válida para SQLite. Ex: SELECT p.nome, e.quantidade_disponivel FROM produtos p JOIN estoque e ON p.id = e.produto_id WHERE e.quantidade_disponivel <= e.estoque_minimo'
            }
          },
          required: ['sql']
        }
      }
    }
  ];

  const executedQueries = [];

  try {
    // Loop de chamada de ferramentas (máximo 3 turnos para evitar loops)
    for (let turn = 0; turn < 3; turn++) {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model,
          messages,
          tools,
          tool_choice: 'auto',
          temperature: 0.2,
          max_tokens: 2048
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Groq API HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      const choice = data.choices?.[0];
      const assistantMsg = choice?.message;

      if (!assistantMsg) {
        throw new Error('Resposta vazia da API do Groq.');
      }

      messages.push(assistantMsg);

      // Se a IA solicitou chamadas de ferramentas:
      if (assistantMsg.tool_calls && assistantMsg.tool_calls.length > 0) {
        for (const call of assistantMsg.tool_calls) {
          if (call.function?.name === 'executar_consulta_sql') {
            let sqlArg = '';
            try {
              const parsedArgs = JSON.parse(call.function.arguments || '{}');
              sqlArg = parsedArgs.sql || '';
            } catch {
              sqlArg = call.function.arguments || '';
            }

            let toolResult;
            try {
              const rows = executeReadOnlyQuery(sqlArg);
              executedQueries.push({ sql: sqlArg, count: rows.length, success: true });
              toolResult = JSON.stringify({ total_linhas: rows.length, dados: rows });
            } catch (queryErr) {
              executedQueries.push({ sql: sqlArg, error: queryErr.message, success: false });
              toolResult = JSON.stringify({ erro: queryErr.message });
            }

            messages.push({
              role: 'tool',
              tool_call_id: call.id,
              content: toolResult
            });
          }
        }
        // Continua o loop para a IA sintetizar o resultado da ferramenta
      } else {
        // Resposta final gerada
        const finalContent = assistantMsg.content || '';
        return {
          configured: true,
          model,
          answer: `${deterministicPrefix}\n\n[Análise Inteligente Groq - ${model}]:\n${finalContent}`,
          queries: executedQueries
        };
      }
    }

    // Caso o loop atinja o limite de turnos
    const lastMsg = messages[messages.length - 1];
    return {
      configured: true,
      model,
      answer: `${deterministicPrefix}\n\n[Análise Inteligente Groq - ${model}]:\n${lastMsg?.content || 'Consulta concluída.'}`,
      queries: executedQueries
    };
  } catch (err) {
    return {
      configured: true,
      model,
      answer: `${deterministicPrefix}\n\n[Erro ao consultar Groq (${model})]: ${err.message}\nPergunta recebida: ${String(userMessage || '')}`,
      queries: executedQueries
    };
  }
}
