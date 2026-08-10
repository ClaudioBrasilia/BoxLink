# Checklist de publicação na Play Store

## 1. Build assinado (automatizado no GitHub Actions)

O workflow `.github/workflows/release-aab.yml` gera um **Android App Bundle
(.aab)** assinado — formato exigido pela Play Store (APK debug não serve para
publicação).

### Gerar a chave de upload (uma única vez, localmente)

```bash
keytool -genkeypair -v \
  -keystore upload-keystore.jks \
  -alias boxlink-upload \
  -keyalg RSA -keysize 2048 -validity 10000
```

Guarde `upload-keystore.jks` e as senhas escolhidas em um cofre (1Password,
Bitwarden etc.) — **se perder essa chave, é preciso abrir um chamado com o
suporte da Play Store para trocá-la**. Nunca a commite no repositório.

### Converter para base64 e cadastrar os secrets no GitHub

```bash
base64 -w0 upload-keystore.jks   # copie a saída
```

Em **Settings → Secrets and variables → Actions** do repositório, crie:

| Secret | Valor |
| --- | --- |
| `ANDROID_KEYSTORE_BASE64` | saída do comando acima |
| `ANDROID_KEYSTORE_PASSWORD` | senha do keystore |
| `ANDROID_KEY_ALIAS` | `boxlink-upload` (ou o alias escolhido) |
| `ANDROID_KEY_PASSWORD` | senha da chave |

Os secrets `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` já existem (usados
pelo build de APK debug).

### Rodar o build

- **Manual:** aba Actions → "Build Release AAB (Play Store)" → Run workflow,
  informando `versionCode` (sempre maior que o último publicado) e
  `versionName` (ex.: `1.0.0`).
- **Por tag:** `git tag v1.0.0 && git push origin v1.0.0` dispara o mesmo
  workflow automaticamente.

O `.aab` assinado fica disponível como artifact do run, pronto para subir no
Play Console.

## 2. Já pronto no projeto

- Ícone adaptável, splash screen e permissões do `AndroidManifest.xml`
  configurados.
- Política de privacidade em `public/privacy.html`, publicada em
  `https://boxlink.vercel.app/privacy.html` (URL corrigida no
  `strings.xml` e no `vercel.json`, que antes reescrevia essa página para o
  app React em vez de servir o HTML).
- Ícone de alta resolução para a loja: `public/pwa-512x512.png` (512×512).
- Screenshots em `marketing/loja/` (7 imagens).

## 3. Pendências que só se resolvem no Play Console (fora do código)

- **Conta de desenvolvedor** Google Play (taxa única de US$ 25), se ainda não
  existir.
- **Ficha da loja**: nome, descrição curta (80 caracteres) e completa (4000),
  categoria (Saúde e fitness), e-mail/site de contato.
- **Gráfico de destaque (feature graphic) 1024×500** — ainda não existe no
  repo; a Play Store exige esse asset além dos screenshots.
- **Screenshots**: os arquivos em `marketing/loja/` são 1290×2796 (proporção
  ~1:2,17). O limite da Play Store é proporção máxima 1:2 — pode ser
  necessário recortar levemente antes do upload.
- **Formulário de Segurança de Dados (Data Safety)**: o app coleta
  localização (check-in), frequência cardíaca/passos/calorias (Health
  Connect) e dados de conta — declare isso no Play Console usando o texto de
  `public/privacy.html` como referência.
- **Classificação de conteúdo** (content rating questionnaire) e **público-
  alvo/idade** — preenchidos no Play Console.
- **google-services.json**: opcional; só necessário se push notifications via
  Firebase forem usadas (o `build.gradle` já lida com a ausência do arquivo).

## 4. Depois do primeiro upload

A Play Store usa **Play App Signing**: você envia o `.aab` assinado com a
chave de upload, e o Google re-assina com a chave de distribuição definitiva.
Para automatizar o envio direto ao Play Console (sem baixar/subir manualmente
o artifact), dá para adicionar depois uma action como
`r0adkll/upload-google-play`, usando uma conta de serviço do Google Cloud
com acesso à Play Console API — requer configuração adicional na conta do
Google Play que ainda não foi feita aqui.
