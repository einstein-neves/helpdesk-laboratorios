const path = require("path");
require("dotenv").config({
    path: path.resolve(__dirname, "../../.env"),
    quiet: true
});

// Leitura sob demanda: o backend SQL pode iniciar sem configurar as APIs.
function getSupabaseConfig({ admin = false } = {}) {
    const url = process.env.SUPABASE_URL?.trim();
    const key = admin
        ? (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)?.trim()
        : (process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY)?.trim();

    if (!url || !key) {
        throw new Error(admin
            ? "Configure SUPABASE_URL e SUPABASE_SECRET_KEY no backend."
            : "Configure SUPABASE_URL e SUPABASE_PUBLISHABLE_KEY no backend.");
    }

    let parsed;
    try { parsed = new URL(url); } catch {
        throw new Error("SUPABASE_URL inválida.");
    }
    if (parsed.protocol !== "https:" || parsed.username || parsed.password ||
        parsed.search || parsed.hash || parsed.pathname !== "/") {
        throw new Error("SUPABASE_URL deve ser a URL HTTPS do projeto, sem credenciais ou caminhos.");
    }

    if (!admin && process.env.SUPABASE_PUBLISHABLE_KEY && !key.startsWith("sb_publishable_")) {
        throw new Error("SUPABASE_PUBLISHABLE_KEY deve começar com sb_publishable_.");
    }
    if (admin && process.env.SUPABASE_SECRET_KEY && !key.startsWith("sb_secret_")) {
        throw new Error("SUPABASE_SECRET_KEY deve começar com sb_secret_.");
    }
    // Evita publicar uma secret key colocada por engano na variável legada anon.
    if (!admin && key.startsWith("sb_secret_")) {
        throw new Error("Uma secret key não pode ser usada como chave pública.");
    }

    return { url: parsed.origin, key };
}

// Não exporta process.env nem inclui a chave administrativa na configuração pública.
function getPublicSupabaseConfig() {
    const { url, key } = getSupabaseConfig();
    return { url, publishableKey: key };
}

module.exports = { getSupabaseConfig, getPublicSupabaseConfig };
