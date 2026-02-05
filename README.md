# 🔐 CyberChef Playground

A CTF-style challenge platform for learning cryptography and reverse engineering using CyberChef recipes. Perfect for defensive content engineers, blue team training, and security education!

## ✨ Features

- 🎯 **Progressive Challenges**: Start from easy to hard challenge
- 🔗 **4 Recipe Formats**: Deep Link, Clean JSON, Compact JSON, Chef Format
- 🏆 **Flag System**: Earn flags for each solved challenge
- 🔧 **Easy CTF Creation**: Simple JSON-based challenge system
- 🚀 **No Browser Needed**: Pure Node.js with cyberchef-node
- 🐳 **Docker**: Docker file and docker compose ready to deploy

## 🆕 Deep Link Support!

We support the **the full CyberChef URL** directly - no need to export recipes manually.

### How It Works

1. **Create your recipe** in CyberChef
2. **Copy the URL** from your browser
3. **Paste it** in the playground (set format to "Deep Link")
4. **Submit** and get validated!

### Example Deep Link
```
https://gchq.github.io/CyberChef/#recipe=XOR(%7B'option':'Hex','string':'42'%7D,'Standard',false)&input=c2Rhc2FkYXNkYXNkYXNkc2Fk
```

The playground will:
- ✅ Extract the recipe from URL
- ✅ Automatically decode URL encoding
- ✅ Ignore input data
- ✅ Validate your solution

## 📋 Supported Recipe Formats

### 1. 🔗 Deep Link (Recommended!)
**Best for**: Quick testing and submissions

Paste the full CyberChef URL:
```
https://gchq.github.io/CyberChef/#recipe=To_Base64('A-Za-z0-9%2B/%3D')&input=dGVzdA
```

### 2. 📄 Clean JSON
**Best for**: Readable recipes, version control

Export from CyberChef → Save recipe → Clean JSON:
```json
[
  {
    "op": "XOR",
    "args": [
      {"option": "Hex", "string": "42"},
      "Standard",
      false
    ]
  }
]
```

### 3. 📦 Compact JSON
**Best for**: Sharing on chat/messaging

Export from CyberChef → Save recipe → Compact JSON:
```json
[{"op":"XOR","args":[{"option":"Hex","string":"42"},"Standard",false]}]
```

### 4. 🔧 Chef Format
**Best for**: Command-line tools

Export from CyberChef → Save recipe → Chef format:
```
XOR({'option':'Hex','string':'42'},'Standard',false)
```

## 🚀 Quick Start

### Option 1: Docker (Recommended! 🐳)

**Easiest way to get started - works on Windows, Mac, and Linux!**

#### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) or docker installed and **running** 

#### Start Here! 🪟
```bash
# Build the Docker image (first time only, takes 2-5 min)
docker-compose build

# Start the application
docker-compose up -d

# Check if running
docker-compose ps
```

**Access:** http://localhost:3000

**Useful Commands:**
```powershell
# View logs
docker-compose logs -f

# Stop
docker-compose down

# Restart
docker-compose restart
```

**Troubleshooting:**
- ❌ "cannot find the file specified" → Docker Desktop not running! Start it first.
- ❌ "port already in use" → Change port in docker-compose.yml

---

### Option 2: Self-Hosted with npm

**For local development without Docker**

#### Prerequisites
- Node.js 18+ and npm 9+

#### Installation

```bash
# Install dependencies
npm install

# Start server (production mode)
npm start

# OR development mode (with auto-restart)
npm run dev
```

**Access:** http://localhost:3000

---

### Option 3: Production Deployment (Docker + Nginx + SSL)

**For public-facing deployments with HTTPS**

```bash
# Generate SSL certificates

# For production (Let's Encrypt):
sudo certbot --nginx -d your-domain.com

# Update domain in nginx/conf.d/cyberchef.conf
# Then start with production config
docker-compose -f docker-compose.production.yml up -d
```

**Access:** https://your-domain.com

**Production Features:**
- ✅ Nginx reverse proxy
- ✅ SSL/TLS encryption
- ✅ Rate limiting (10 req/s API, 5 req/s downloads)
- ✅ Security headers
- ✅ Gzip compression
- ✅ Static file caching

---

### 🎯 Which Option Should I Choose?

| Use Case | Recommended Option | Why? |
|----------|-------------------|------|
| **Just want to try it** | Docker | Fastest, minimal setup |
| **Windows user** | Docker | Best compatibility |
| **Local development** | npm | Direct code access |
| **Public CTF/Training** | Docker Production | SSL/TLS, hardened |
| **Team deployment** | Docker Production | Scalable, maintainable |

---

## 🎓 Play Challenges

1. Open http://localhost:3000
2. Download challenge files
3. Reverse engineer the encryption
4. Create decryption recipe in CyberChef
5. Copy URL or export recipe
6. Submit and earn flags!

## 📁 Project Structure

```
CyberChef-Playground/
├── server.js                  ← Main server 
├── public/
│   └── index.html            ← Frontend 
├── challenges-config/        ← Challenge metadata
│   ├── level1.json
│   ├── level2.json
│   └── ...
├── solutions/                ← Solution recipes
│   ├── level1_solution.json
│   ├── level2_solution.json
│   └── ...
└── challenges/               ← Challenge files
    ├── level1_challenge.zip
    ├── level1_validation.bin
    ├── level2_challenge.zip
    ├── level2_validation.bin
    └── ...
```

## 🎓 How Validation Works

```
User submits recipe (any of 4 formats)
         ↓
Server parses format:
  • Deep Link → Extract from URL + decode
  • Chef Format → Parse operations
  • JSON → Parse directly
         ↓
Run user recipe on validation file
         ↓
Run solution recipe on same file
         ↓
Compare SHA256 hashes
         ↓
Match? → Award flag!
No match? → Show hint
```

## 🎨 Creating Custom Challenges

See [CTF_AUTHOR_GUIDE.md](CTF_AUTHOR_GUIDE.md) for detailed instructions.

### Quick Challenge Creation

1. **Create encryption program**
   ```bash
   gcc myencrypt.c -o myencrypt
   ./myencrypt  # Generates sample + validation files
   ```

2. **Test in CyberChef**
   - Open https://gchq.github.io/CyberChef/
   - Create decryption recipe
   - Copy URL or export recipe
   - Save as `solutions/levelN_solution.json`

3. **Create config** at `challenges-config/levelN.json`:
   ```json
   {
     "id": N,
     "name": "Challenge Name",
     "description": "What to solve",
     "hint": "Helpful hint",
     "flag": "CYBER{flag_here}",
     "challengeFiles": [
       {
         "name": "Challenge Package",
         "file": "levelN_challenge.zip"
       }
     ],
     "validationFile": "levelN_validation.bin",
     "solutionFile": "levelN_solution.json"
   }
   ```

4. **Copy files**
   ```bash
   cp levelN_challenge.zip challenges/
   cp levelN_validation.bin challenges/
   ```

5. **Restart server** - Challenge appears automatically!

## 💡 Tips for Players

### Getting Started
1. Always test your recipe in CyberChef first
2. Make sure decryption output matches expected result
3. Use the **Deep Link format** for fastest workflow

### Common Issues
- **"Invalid recipe format"**: Check your URL or JSON syntax
- **"Incorrect decryption"**: Verify output matches expected result
- **URL not working**: Make sure you include the full URL starting with `https://`

### Pro Tips
- 🔗 **Deep Link is fastest**: Just copy browser URL!
- 🧪 **Test incrementally**: Build recipe step by step
- 📝 **Read hints carefully**: They contain important clues
- 🔍 **Use CyberChef's Magic**: Auto-detect operations when stuck

## 🔧 Technical Details

### Dependencies
- **express**: Web server
- **cyberchef-node**: All 300+ CyberChef operations in Node.js
- Pure Node.js - no browser required!

### Recipe Parsing
The server supports 4 input formats and converts them all to the internal CyberChef JSON format:

```javascript
// Deep Link parsing
parseDeepLink(url) → extracts recipe from URL hash
                   → decodes URL encoding
                   → returns Chef format string
                   → parsed to JSON

// Chef Format parsing  
parseChefFormat(string) → parses operation syntax
                        → converts to JSON format

// JSON parsing
JSON.parse(string) → direct parsing
```

### Security Features
- ✅ Session-based progress tracking
- ✅ Separate validation files (not given to players)
- ✅ Path sanitization for file downloads
- ✅ Rate limiting ready
- ✅ No directory traversal

## 📚 References
- **[CHANGELOG.md](CHANGELOG.md)** - Version history and updates
- [CyberChef Documentation](https://github.com/gchq/CyberChef/wiki) - Learn CyberChef operations
- [cyberchef-node](https://github.com/gchq/CyberChef-server) - Node.js API docs

## 🤝 Contributing

This is a blue team training tool for defensive content engineers. Feel free to:
- Add new challenges
- Improve parsing logic
- Add more recipe format support
- Enhance UI/UX
- Report bugs

## 📝 License

Built for educational and training purposes. CyberChef is developed by GCHQ.

## 🙏 Credits

- **CyberChef** by GCHQ - Amazing crypto/data tool
- **cyberchef-node** - Node.js implementation
- Built with ❤️ for blue team training

---

**Ready to play?** 
- 🐳 Docker: `docker-compose up -d`
- 📦 npm: `npm start`
- 🌐 Access: http://localhost:3000

**Need help?** Check the guides above or open an issue! 🆘