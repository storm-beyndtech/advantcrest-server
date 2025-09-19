import fetch from 'node-fetch';

// CoinGecko API - free tier, no API key required
const COINGECKO_API_URL = 'https://api.coingecko.com/api/v3/simple/price';

// Common coin mappings to CoinGecko IDs
const COIN_ID_MAPPING = {
  'bitcoin': 'bitcoin',
  'btc': 'bitcoin',
  'ethereum': 'ethereum',
  'eth': 'ethereum',
  'usdt': 'tether',
  'tether': 'tether',
  'usdc': 'usd-coin',
  'bnb': 'binancecoin',
  'binance': 'binancecoin',
  'ada': 'cardano',
  'cardano': 'cardano',
  'sol': 'solana',
  'solana': 'solana',
  'xrp': 'ripple',
  'ripple': 'ripple',
  'dot': 'polkadot',
  'polkadot': 'polkadot',
  'avax': 'avalanche-2',
  'avalanche': 'avalanche-2',
  'matic': 'matic-network',
  'polygon': 'matic-network',
  'link': 'chainlink',
  'chainlink': 'chainlink',
  'ltc': 'litecoin',
  'litecoin': 'litecoin',
  'bch': 'bitcoin-cash',
  'bitcoin-cash': 'bitcoin-cash',
  'uni': 'uniswap',
  'uniswap': 'uniswap',
  'atom': 'cosmos',
  'cosmos': 'cosmos',
  'near': 'near',
  'ftm': 'fantom',
  'fantom': 'fantom',
  'algo': 'algorand',
  'algorand': 'algorand',
  'icp': 'internet-computer',
  'internet-computer': 'internet-computer',
  'vet': 'vechain',
  'vechain': 'vechain',
  'fil': 'filecoin',
  'filecoin': 'filecoin',
  'trx': 'tron',
  'tron': 'tron',
  'etc': 'ethereum-classic',
  'ethereum-classic': 'ethereum-classic',
  'xmr': 'monero',
  'monero': 'monero',
  'xlm': 'stellar',
  'stellar': 'stellar',
  'aave': 'aave',
  'mkr': 'maker',
  'maker': 'maker',
  'comp': 'compound-governance-token',
  'compound': 'compound-governance-token',
  'snx': 'havven',
  'synthetix': 'havven',
  'crv': 'curve-dao-token',
  'curve': 'curve-dao-token',
  'sushi': 'sushi',
  'sushiswap': 'sushi',
  '1inch': '1inch',
  'yfi': 'yearn-finance',
  'yearn': 'yearn-finance',
  'lrc': 'loopring',
  'loopring': 'loopring',
  'bat': 'basic-attention-token',
  'basic-attention-token': 'basic-attention-token',
  'zrx': '0x',
  'omg': 'omisego',
  'omisego': 'omisego',
  'zil': 'zilliqa',
  'zilliqa': 'zilliqa',
  'ren': 'republic-protocol',
  'republic': 'republic-protocol',
  'knc': 'kyber-network-crystal',
  'kyber': 'kyber-network-crystal',
  'storj': 'storj',
  'gnt': 'golem',
  'golem': 'golem',
  'mana': 'decentraland',
  'decentraland': 'decentraland',
  'enj': 'enjincoin',
  'enjin': 'enjincoin',
  'sand': 'the-sandbox',
  'sandbox': 'the-sandbox',
  'axs': 'axie-infinity',
  'axie': 'axie-infinity',
  'gala': 'gala',
  'chr': 'chromaway',
  'chromia': 'chromaway',
  'alice': 'my-neighbor-alice',
  'tlm': 'alien-worlds',
  'alien-worlds': 'alien-worlds',
  'slp': 'smooth-love-potion',
  'smooth-love-potion': 'smooth-love-potion'
};

/**
 * Fetch current crypto prices from CoinGecko API
 * @param {Array} coinSymbols - Array of coin symbols/names to fetch prices for
 * @returns {Object} - Object with coin symbols as keys and prices as values
 */
export const fetchCryptoPrices = async (coinSymbols = []) => {
  try {
    if (!coinSymbols || coinSymbols.length === 0) {
      return {};
    }

    // Map coin symbols to CoinGecko IDs
    const coinIds = coinSymbols
      .map(symbol => {
        const normalizedSymbol = symbol.toLowerCase().trim();
        return COIN_ID_MAPPING[normalizedSymbol] || normalizedSymbol;
      })
      .filter(Boolean)
      .join(',');

    if (!coinIds) {
      console.warn('No valid coin IDs found for symbols:', coinSymbols);
      return {};
    }

    const url = `${COINGECKO_API_URL}?ids=${coinIds}&vs_currencies=usd&include_24hr_change=true`;
    
    console.log(`Fetching crypto prices from: ${url}`);
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'AdvantCrest-Trading-Platform/1.0'
      },
      timeout: 10000 // 10 second timeout
    });

    if (!response.ok) {
      throw new Error(`CoinGecko API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    // Transform the response to match our coin symbols
    const prices = {};
    
    for (const [originalSymbol, coinId] of Object.entries(COIN_ID_MAPPING)) {
      if (data[coinId] && coinSymbols.some(s => s.toLowerCase() === originalSymbol)) {
        prices[originalSymbol] = {
          price: data[coinId].usd,
          change24h: data[coinId].usd_24h_change || 0,
          lastUpdated: new Date().toISOString()
        };
      }
    }

    // Also check for direct matches
    coinSymbols.forEach(symbol => {
      const normalizedSymbol = symbol.toLowerCase();
      if (data[normalizedSymbol] && !prices[normalizedSymbol]) {
        prices[normalizedSymbol] = {
          price: data[normalizedSymbol].usd,
          change24h: data[normalizedSymbol].usd_24h_change || 0,
          lastUpdated: new Date().toISOString()
        };
      }
    });

    console.log(`Successfully fetched prices for ${Object.keys(prices).length} coins`);
    return prices;

  } catch (error) {
    console.error('Error fetching crypto prices:', error.message);
    return {};
  }
};

/**
 * Get price for a specific coin with fallback
 * @param {string} coinSymbol - Coin symbol/name
 * @param {number} fallbackPrice - Fallback price if API fails
 * @returns {Object} - Price data object
 */
export const getCoinPrice = async (coinSymbol, fallbackPrice = 0) => {
  try {
    const prices = await fetchCryptoPrices([coinSymbol]);
    const normalizedSymbol = coinSymbol.toLowerCase();
    
    if (prices[normalizedSymbol]) {
      return {
        price: prices[normalizedSymbol].price,
        change24h: prices[normalizedSymbol].change24h,
        source: 'api',
        lastUpdated: prices[normalizedSymbol].lastUpdated
      };
    }
    
    // Fallback to admin-set price
    return {
      price: fallbackPrice,
      change24h: 0,
      source: 'fallback',
      lastUpdated: new Date().toISOString()
    };
    
  } catch (error) {
    console.error(`Error fetching price for ${coinSymbol}:`, error.message);
    return {
      price: fallbackPrice,
      change24h: 0,
      source: 'fallback',
      lastUpdated: new Date().toISOString()
    };
  }
};

/**
 * Update coin prices in database with live API data
 * @param {Array} coins - Array of coin objects from database
 * @returns {Array} - Updated coins array with current prices
 */
export const updateCoinPricesFromAPI = async (coins = []) => {
  try {
    if (!coins || coins.length === 0) {
      return [];
    }

    // Extract coin symbols that have API mapping
    const coinSymbols = coins
      .filter(coin => coin.apiSymbol || coin.name)
      .map(coin => coin.apiSymbol || coin.name);

    const apiPrices = await fetchCryptoPrices(coinSymbols);
    
    // Update coins with API prices or use fallback
    const updatedCoins = coins.map(coin => {
      const symbol = (coin.apiSymbol || coin.name).toLowerCase();
      
      if (apiPrices[symbol]) {
        return {
          ...coin.toObject ? coin.toObject() : coin,
          price: apiPrices[symbol].price,
          change24h: apiPrices[symbol].change24h,
          priceSource: 'api',
          lastPriceUpdate: apiPrices[symbol].lastUpdated
        };
      }
      
      // Use fallback price if API failed
      return {
        ...coin.toObject ? coin.toObject() : coin,
        price: coin.fallbackPrice || coin.price || 0,
        change24h: 0,
        priceSource: 'fallback',
        lastPriceUpdate: new Date().toISOString()
      };
    });

    console.log(`Updated prices for ${updatedCoins.length} coins`);
    return updatedCoins;
    
  } catch (error) {
    console.error('Error updating coin prices:', error.message);
    
    // Return original coins with fallback prices
    return coins.map(coin => ({
      ...coin.toObject ? coin.toObject() : coin,
      price: coin.fallbackPrice || coin.price || 0,
      change24h: 0,
      priceSource: 'fallback',
      lastPriceUpdate: new Date().toISOString()
    }));
  }
};

export default {
  fetchCryptoPrices,
  getCoinPrice,
  updateCoinPricesFromAPI,
  COIN_ID_MAPPING
};