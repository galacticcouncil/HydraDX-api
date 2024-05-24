SELECT
    id, 
    name, 
    symbol, 
    NULL AS totalSupply, 
    NULL AS circulatingSupply, 
    coingecko_id AS coinGeckoId, 
    coinmarketcap_id AS coinMarketCapId
FROM
    token_metadata
WHERE
    CASE
        WHEN :asset IS NOT NULL
        THEN id = :asset
        ELSE true
    END
ORDER BY 
    id;