#!/usr/bin/env node

import { DynamoDBClient, ScanCommand } from '@aws-sdk/client-dynamodb';
import { unmarshall } from '@aws-sdk/util-dynamodb';

/**
 * Query the latest 10 transactions from DynamoDB
 * Usage: node scripts/query-latest-transactions.mjs [env] [limit]
 * Example: node scripts/query-latest-transactions.mjs dev 10
 */

const env = process.argv[2] || 'dev';
const limit = parseInt(process.argv[3]) || 10;
const profile = process.argv[4] || 'dev';

const tableName = `yorutsuke-transactions-us-${env}`;

// Initialize DynamoDB client
const client = new DynamoDBClient({
  region: 'us-east-1',
});

async function queryLatestTransactions() {
  try {
    console.log(`📊 Fetching latest ${limit} transactions from: ${tableName}\n`);

    const command = new ScanCommand({
      TableName: tableName,
      Limit: limit * 2, // Fetch more to ensure we get enough valid items
    });

    const response = await client.send(command);

    if (!response.Items || response.Items.length === 0) {
      console.log('No transactions found.');
      return;
    }

    // Unmarshall the items
    const transactions = response.Items.map(item => unmarshall(item));

    // Sort by createdAt in descending order (newest first)
    transactions.sort((a, b) => {
      const aTime = new Date(a.createdAt).getTime();
      const bTime = new Date(b.createdAt).getTime();
      return bTime - aTime;
    });

    // Get only the requested limit
    const latest = transactions.slice(0, limit);

    // Display results
    console.log(`✅ Found ${latest.length} recent transactions:\n`);
    console.log('─'.repeat(100));

    latest.forEach((txn, index) => {
      console.log(`\n[${index + 1}] Transaction ID: ${txn.transactionId}`);
      console.log(`    User ID: ${txn.userId}`);
      console.log(`    Amount: ¥${txn.totalAmount || 0}`);
      console.log(`    Category: ${txn.category || 'N/A'}`);
      console.log(`    Date: ${txn.date || 'N/A'}`);
      console.log(`    Created: ${txn.createdAt || 'N/A'}`);
      console.log(`    Status: ${txn.status || 'N/A'}`);

      // Show model comparison if available
      if (txn.modelComparison) {
        console.log(`    Models:`);
        Object.entries(txn.modelComparison).forEach(([model, data]) => {
          console.log(
            `      - ${model}: ¥${data.totalAmount || 0} (confidence: ${data.confidence || 0}%)`
          );
        });
      }
    });

    console.log('\n' + '─'.repeat(100));
    console.log(`\n✨ Retrieved ${latest.length} transactions successfully.\n`);

    // Print raw JSON if verbose mode
    if (process.argv.includes('--json')) {
      console.log('\n📋 Raw JSON Data:');
      console.log(JSON.stringify(latest, null, 2));
    }
  } catch (error) {
    console.error('❌ Error querying DynamoDB:', error.message);
    console.error('\nTroubleshooting:');
    console.error('1. Verify AWS credentials: aws sts get-caller-identity --profile ' + profile);
    console.error('2. Check table exists: aws dynamodb describe-table --table-name ' + tableName + ' --profile ' + profile);
    console.error('3. Verify permissions: Check IAM policy allows DynamoDB Scan');
    process.exit(1);
  } finally {
    await client.destroy();
  }
}

// Run the query
await queryLatestTransactions();
