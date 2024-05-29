-- statsAccountsCount
WITH accounts AS (
    SELECT args -> 'who' AS account_id
    FROM event
    WHERE name = 'Tokens.Endowed'
    UNION
    SELECT args -> 'account' AS account_id
    FROM event
    WHERE name = 'Balances.Endowed'
)
SELECT COUNT(DISTINCT account_id)
FROM accounts;
