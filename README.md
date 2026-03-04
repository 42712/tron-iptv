# 🎬 Tron IPTV Player

Next Generation IPTV Streaming Player — layout estilo IPTV Smarters.

---

## 📁 Estrutura do Projeto

```
tron-iptv/
├── index.html              ← App principal (todo o player)
├── netlify.toml            ← Configuração do Netlify (CORS + redirects)
├── package.json            ← Dependências das funções serverless
├── .gitignore
├── README.md
└── netlify/
    └── functions/
        └── proxy.js        ← Proxy CORS para carregar listas M3U
```

---

## 🚀 Deploy Passo a Passo

### PASSO 1 — Criar repositório no GitHub

1. Acesse **github.com** e faça login
2. Clique em **"New repository"** (botão verde)
3. Nome: `tron-iptv`
4. Deixe **Public** (para o Netlify free tier)
5. **NÃO** marque "Add README" (já temos um)
6. Clique **"Create repository"**

---

### PASSO 2 — Enviar os arquivos para o GitHub

**Opção A — Pelo navegador (mais fácil):**

1. No repositório criado, clique **"uploading an existing file"**
2. Arraste TODOS os arquivos desta pasta
3. **Atenção:** Para a pasta `netlify/functions/proxy.js`, você precisa criar manualmente:
   - Clique **"Create new file"**
   - No nome escreva: `netlify/functions/proxy.js`
   - Cole o conteúdo do arquivo proxy.js
4. Clique **"Commit changes"**

**Opção B — Pelo terminal (Git):**

```bash
cd tron-iptv
git init
git add .
git commit -m "🚀 Tron IPTV - Initial deploy"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/tron-iptv.git
git push -u origin main
```

---

### PASSO 3 — Deploy no Netlify

1. Acesse **netlify.com** e faça login
2. Clique **"Add new site"** → **"Import an existing project"**
3. Escolha **"Deploy with GitHub"**
4. Autorize o Netlify a acessar sua conta GitHub
5. Selecione o repositório **tron-iptv**
6. Configurações de build:
   - **Base directory:** *(deixe vazio)*
   - **Build command:** *(deixe vazio)*
   - **Publish directory:** `.` *(ponto)*
7. Clique **"Deploy site"**
8. Aguarde ~1 minuto → seu site estará no ar! ✅

---

### PASSO 4 — Domínio personalizado (opcional)

No Netlify:
1. **Site settings** → **Domain management**
2. **Add custom domain** → ex: `troniptv.com.br`
3. Siga as instruções de DNS

Ou use o domínio gratuito do Netlify:
`https://tron-iptv.netlify.app`

---

## ⚡ Por que o Player Precisa de Proxy?

Listas M3U e streams IPTV têm restrições de **CORS** (Cross-Origin Resource Sharing).
O browser bloqueia requisições diretas a servidores externos por segurança.

**Solução:** O arquivo `netlify/functions/proxy.js` cria um endpoint serverless
que faz a requisição pelo servidor (sem restrição CORS) e retorna para o browser.

### Como o proxy é chamado no player:
```
https://seu-site.netlify.app/.netlify/functions/proxy?url=SUA_URL_M3U
```

---

## 🔧 Configurar o Player para usar o Proxy Netlify

Após o deploy, abra o `index.html` e encontre esta linha:

```javascript
const PROXY='https://api.allorigins.win/raw?url=';
```

Substitua por:

```javascript
const PROXY='/.netlify/functions/proxy?url=';
```

Isso faz o player usar **seu próprio proxy** em vez do serviço externo.
Depois faça commit e o Netlify atualiza automaticamente.

---

## 📺 Como Usar o Player

### Login com Usuário/Senha:
- **Any Name:** apelido para identificar (ex: "Casa")
- **Username:** seu usuário IPTV
- **Password:** sua senha IPTV
- **URL:** endereço do servidor (ex: `http://servidor.com:8080`)
- O player monta a URL M3U automaticamente

### Login com URL M3U:
- Cole diretamente a URL da sua lista M3U/M3U+

### Funcionalidades:
- 📺 **TV ao Vivo** — canais em tempo real
- 🎬 **Filmes** — conteúdo VOD
- 📂 **Séries** — séries e temporadas
- ⭐ **Favoritos** — salvos localmente
- 📺 **Multi-Tela** — mini player enquanto navega
- ⚙️ **Idioma** — Português / English
- 🔄 **Reload** — recarrega a lista sem sair

---

## 🛠️ Problemas Comuns

### Lista não carrega:
- Verifique se o usuário/senha e o servidor estão corretos
- Teste a URL M3U diretamente no navegador
- Ative o proxy Netlify (seção acima)

### Stream não reproduz:
- Streams IPTV em `.m3u8` (HLS) funcionam melhor
- Streams `.ts` diretos podem ter restrições CORS no browser
- Recomendado: use em Chrome ou Edge

### Erro de CORS:
- Ative o proxy Netlify conforme instruções acima

---

## 📱 Compatibilidade

| Plataforma | Suporte |
|------------|---------|
| Chrome (desktop) | ✅ Completo |
| Edge (desktop) | ✅ Completo |
| Firefox | ✅ Completo |
| Safari | ⚠️ Parcial (HLS nativo) |
| Android Chrome | ✅ Bom |
| iOS Safari | ⚠️ Limitado |

---

## 🔒 Segurança

- Nenhuma senha é enviada para servidores externos
- Credenciais salvas apenas no **localStorage** do seu browser
- O proxy Netlify valida URLs antes de fazer requisições
- Não há backend, banco de dados ou coleta de dados

---

*Tron IPTV — Desenvolvido com ❤️*
