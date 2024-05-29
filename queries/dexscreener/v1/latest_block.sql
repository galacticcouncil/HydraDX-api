-- dexscreenerLatestblock

/*
  Returns latest block
*/

SELECT
    MAX(block.height) AS blockNumber,
    CAST(EXTRACT(EPOCH FROM MAX(block.timestamp)) as bigint) AS blockTimestamp
FROM
    block
JOIN
    event ON block.id = event.block_id
WHERE
    block.timestamp > NOW() - INTERVAL '1 day';