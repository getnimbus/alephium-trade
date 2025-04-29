# Alephium Trade - Index Swap Trade Data Pricing

This project provides tools and services for managing and analyzing index swap trade data for pricing purposes on Alephium Chain

## Features

- Index swap trade data
- Discovery new pools and tokens
- Real-time pricing calculations
- Token price API server for real-time price queries

## Prerequisites

- Node.js 22 or above
- Postgres
- Kafka
- Fetching onchain data [https://github.com/getnimbus/alephium-indexer]

## Quickstart

1. Clone the repository:
   ```bash
   git clone https://github.com/getnimbus/alephium-trade
   cd alephium-trade
   ```

2. Install dependencies:
   ```bash
   yarn
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. Build service
   ```bash
   yarn build
   ```

5. Start consumer worker
   ```bash
   yarn start
   ```

6. Start pricing server
   ```bash
   yarn start:server
   ```

## Development

### Project Structure

```
alephium-trade/
├── src/                    # Source code
│   ├── configs/            # Configuration files
│   ├── controllers/        # API controllers
│   ├── executors/          # Task executors
│   ├── services/           # External services
│   ├── utils/              # Utility functions
│   ├── index.ts            # Indexing worker
│   └── server.ts           # Api server
├── prisma/                # Database schema and migrations
```

### Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License

Copyright (c) 2024 Nimbus

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## Support

For support, please contact toanbk21096@gmail.com

## API Documentation

### Token Price API

The API server provides endpoints to query token prices:

- `GET /api/prices?address=...` - Get current price for a specific token

Example response:
```json
{
  "id": "1a281053ba8601a658368594da034c2e99a0fb951b86498d05e76aedfe666800",
  "address": "vT49PY8ksoUL6NcXiZ1t2wAmC7tTPRfFfER8n3UCLvXy",
  "name": "AYIN",
  "symbol": "AYIN",
  "decimals": 18,
  "logo": "https://raw.githubusercontent.com/alephium/token-list/master/logos/AYIN.png",
  "price": 0.327885697388336,
  "timestamp": "1745898351000"
}
```
