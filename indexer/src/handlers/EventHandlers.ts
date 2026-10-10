import { indexer } from "envio";

indexer.onEvent({ contract: "VeilPool", event: "NewCommitment" }, async ({ event, context }) => {
  const poolAddress = event.srcAddress.toLowerCase();
  
  context.Commitment.set({
    id: `${poolAddress}-${event.params.index}`,
    pool: poolAddress,
    index: event.params.index,
    commitment: event.params.commitment,
    memo: event.params.encryptedOutput,
    blockNumber: BigInt(event.block.number),
    txHash: event.transaction.hash
  });

  let stat = await context.PoolStat.get(poolAddress);
  if (!stat) {
    stat = {
      id: poolAddress,
      commitments: 0n,
      nullifiers: 0n
    };
  }
  context.PoolStat.set({
    ...stat,
    commitments: stat.commitments + 1n
  });
});

indexer.onEvent({ contract: "VeilPool", event: "NewNullifier" }, async ({ event, context }) => {
  const poolAddress = event.srcAddress.toLowerCase();
  
  context.Nullifier.set({
    id: `${poolAddress}-${event.params.nullifier}`,
    pool: poolAddress,
    nullifier: event.params.nullifier,
    blockNumber: BigInt(event.block.number)
  });

  let stat = await context.PoolStat.get(poolAddress);
  if (!stat) {
    stat = {
      id: poolAddress,
      commitments: 0n,
      nullifiers: 0n
    };
  }
  context.PoolStat.set({
    ...stat,
    nullifiers: stat.nullifiers + 1n
  });
});

indexer.onEvent({ contract: "StreamVaultFactory", event: "CampaignCreated" }, async ({ event, context }) => {
  const vault = event.params.vault.toLowerCase();
  
  context.Campaign.set({
    id: vault,
    admin: event.params.admin.toLowerCase(),
    createdAt: BigInt(event.block.timestamp),
    totalPaid: 0n,
    posts: 0n
  });
});

indexer.contractRegister({ contract: "StreamVaultFactory", event: "CampaignCreated" }, async ({ event, context }) => {
  context.chain.StreamVault.add(event.params.vault);
});

indexer.onEvent({ contract: "StreamVault", event: "PostRegistered" }, async ({ event, context }) => {
  const vault = event.srcAddress.toLowerCase();
  
  context.Post.set({
    id: `${vault}-${event.params.postId}`,
    campaign: vault,
    postId: event.params.postId,
    xUserId: event.params.xUserId,
    lastImpressions: 0n,
    paid: 0n,
    rejected: false
  });

  const campaign = await context.Campaign.get(vault);
  if (campaign) {
    context.Campaign.set({
      ...campaign,
      posts: campaign.posts + 1n
    });
  }
});

indexer.onEvent({ contract: "StreamVault", event: "Report" }, async ({ event, context }) => {
  const vault = event.srcAddress.toLowerCase();
  const postId = `${vault}-${event.params.postId}`;
  
  const post = await context.Post.get(postId);
  if (post) {
    context.Post.set({
      ...post,
      lastImpressions: event.params.impressions,
      rejected: !event.params.valid
    });
  }
});

indexer.onEvent({ contract: "StreamVault", event: "Payout" }, async ({ event, context }) => {
  const vault = event.srcAddress.toLowerCase();
  const txHash = event.transaction.hash;
  const logIndex = event.logIndex;
  
  context.Payout.set({
    id: `${txHash}-${logIndex}`,
    campaign: vault,
    postId: event.params.postId,
    pubKey: event.params.pubKey,
    amount: event.params.amount,
    blinding: event.params.blinding,
    commitment: event.params.commitment,
    index: BigInt(event.params.index),
    holdback: event.params.holdback,
    blockNumber: BigInt(event.block.number)
  });

  const postId = `${vault}-${event.params.postId}`;
  const post = await context.Post.get(postId);
  if (post) {
    context.Post.set({
      ...post,
      paid: post.paid + event.params.amount
    });
  }

  const campaign = await context.Campaign.get(vault);
  if (campaign) {
    context.Campaign.set({
      ...campaign,
      totalPaid: campaign.totalPaid + event.params.amount
    });
  }
});

indexer.onEvent({ contract: "StreamVault", event: "PostRejected" }, async ({ event, context }) => {
  const vault = event.srcAddress.toLowerCase();
  const postId = `${vault}-${event.params.postId}`;
  
  const post = await context.Post.get(postId);
  if (post) {
    context.Post.set({
      ...post,
      rejected: true
    });
  }
});

indexer.onEvent({ contract: "StreamVault", event: "StreamCreated" }, async ({ event, context }) => {
});

indexer.onEvent({ contract: "StreamVault", event: "Drip" }, async ({ event, context }) => {
});

indexer.onEvent({ contract: "StreamVault", event: "Closed" }, async ({ event, context }) => {
});
