/**
 * @fileoverview Throughput (`tok/s`), token total, and model registry
 * aggregation helpers for single-agent and full session-tree scopes.
 */

export function isStepValidForE2E(step) {
  if (!step) return false;
  if (step.isValidE2ESample !== undefined) return Boolean(step.isValidE2ESample);
  return (
    Number(step.outputTokens) > 0 &&
    Number(step.totalDurationSec) > 0 &&
    Number(step.e2eTokPerSec) > 0
  );
}

/**
 * Computes throughput summary (`tok/s`) for a given slice of step records.
 * E2E throughput includes all steps with positive output and duration, while
 * streaming-only throughput filters out single-packet flushes.
 */
export function computeThroughputWindowSummary(rawSteps) {
  const validSteps = Array.isArray(rawSteps)
    ? rawSteps.filter(isStepValidForE2E)
    : [];
  if (validSteps.length === 0) {
    return {
      sampleCount: 0,
      totalOutputTokens: 0,
      totalThinkingOutputTokens: 0,
      totalResponseOutputTokens: 0,
      totalStreamingDurationSec: 0,
      totalE2EDurationSec: 0,
      weightedStreamingTokPerSec: 0,
      meanStreamingTokPerSec: 0,
      weightedE2ETokPerSec: 0,
      meanE2ETokPerSec: 0,
      meanTtftSec: 0,
      peakStreamingTokPerSec: 0,
      peakE2ETokPerSec: 0,
    };
  }

  let totalOutputTokens = 0;
  let totalThinkingOutputTokens = 0;
  let totalResponseOutputTokens = 0;
  let totalStreamingDurationSec = 0;
  let streamingOutputTokens = 0;
  let streamingSampleCount = 0;
  let totalE2EDurationSec = 0;
  let totalTtftSec = 0;
  let sumStreamingRates = 0;
  let sumE2ERates = 0;
  let peakStreamingTokPerSec = 0;
  let peakE2ETokPerSec = 0;

  for (const step of validSteps) {
    totalOutputTokens += step.outputTokens;
    totalThinkingOutputTokens += step.thinkingOutputTokens;
    totalResponseOutputTokens += step.responseOutputTokens;
    totalE2EDurationSec += step.totalDurationSec;
    totalTtftSec += step.timeToFirstTokenSec;
    sumE2ERates += step.e2eTokPerSec;
    if (step.e2eTokPerSec > peakE2ETokPerSec) {
      peakE2ETokPerSec = step.e2eTokPerSec;
    }
    if (step.isValidThroughputSample && step.streamingDurationSec > 0) {
      totalStreamingDurationSec += step.streamingDurationSec;
      streamingOutputTokens += step.outputTokens;
      streamingSampleCount += 1;
      sumStreamingRates += step.streamingTokPerSec;
      if (step.streamingTokPerSec > peakStreamingTokPerSec) {
        peakStreamingTokPerSec = step.streamingTokPerSec;
      }
    }
  }

  const count = validSteps.length;
  return {
    sampleCount: count,
    totalOutputTokens,
    totalThinkingOutputTokens,
    totalResponseOutputTokens,
    totalStreamingDurationSec,
    totalE2EDurationSec,
    weightedStreamingTokPerSec:
      totalStreamingDurationSec > 0
        ? streamingOutputTokens / totalStreamingDurationSec
        : 0,
    meanStreamingTokPerSec:
      streamingSampleCount > 0 ? sumStreamingRates / streamingSampleCount : 0,
    weightedE2ETokPerSec:
      totalE2EDurationSec > 0 ? totalOutputTokens / totalE2EDurationSec : 0,
    meanE2ETokPerSec: sumE2ERates / count,
    meanTtftSec: totalTtftSec / count,
    peakStreamingTokPerSec,
    peakE2ETokPerSec,
  };
}

/**
 * Sums per-agent throughput summaries across all active nodes in a session tree
 * so that `scope === 'tree'` reflects total combined throughput and total samples.
 */
export function sumThroughputWindowSummaries(summaries) {
  const active = summaries.filter((s) => s && s.sampleCount > 0);
  if (active.length === 0) {
    return computeThroughputWindowSummary([]);
  }
  let sampleCount = 0;
  let totalOutputTokens = 0;
  let totalThinkingOutputTokens = 0;
  let totalResponseOutputTokens = 0;
  let totalStreamingDurationSec = 0;
  let totalE2EDurationSec = 0;
  let weightedStreamingTokPerSec = 0;
  let meanStreamingTokPerSec = 0;
  let weightedE2ETokPerSec = 0;
  let meanE2ETokPerSec = 0;
  let weightedTtftSum = 0;
  let peakStreamingTokPerSec = 0;
  let peakE2ETokPerSec = 0;

  for (const s of active) {
    sampleCount += s.sampleCount;
    totalOutputTokens += s.totalOutputTokens;
    totalThinkingOutputTokens += s.totalThinkingOutputTokens;
    totalResponseOutputTokens += s.totalResponseOutputTokens;
    totalStreamingDurationSec += s.totalStreamingDurationSec;
    totalE2EDurationSec += s.totalE2EDurationSec;
    weightedStreamingTokPerSec += s.weightedStreamingTokPerSec;
    meanStreamingTokPerSec += s.meanStreamingTokPerSec;
    weightedE2ETokPerSec += s.weightedE2ETokPerSec;
    meanE2ETokPerSec += s.meanE2ETokPerSec;
    weightedTtftSum += s.meanTtftSec * s.sampleCount;
    peakStreamingTokPerSec += s.peakStreamingTokPerSec;
    peakE2ETokPerSec += s.peakE2ETokPerSec;
  }

  return {
    sampleCount,
    totalOutputTokens,
    totalThinkingOutputTokens,
    totalResponseOutputTokens,
    totalStreamingDurationSec,
    totalE2EDurationSec,
    weightedStreamingTokPerSec,
    meanStreamingTokPerSec,
    weightedE2ETokPerSec,
    meanE2ETokPerSec,
    meanTtftSec: sampleCount > 0 ? weightedTtftSum / sampleCount : 0,
    peakStreamingTokPerSec,
    peakE2ETokPerSec,
  };
}

export function accumulateStepIntoModelGroup(map, step, conversationId = '') {
  const key = `${step.modelDisplayName}||${step.responseModel}||${step.modelEnum}`;
  if (!map.has(key)) {
    map.set(key, {
      modelDisplayName: step.modelDisplayName,
      responseModel: step.responseModel,
      configuredModelId: step.configuredModelId || '',
      modelEnum: step.modelEnum,
      apiProvider: step.apiProvider,
      remainingQuotaFraction:
        step.remainingQuotaFraction !== undefined
          ? step.remainingQuotaFraction
          : null,
      quotaResetTime: step.quotaResetTime || '',
      maxContextTokens: step.maxContextTokens || 0,
      requestCount: 0,
      conversationIds: new Set(),
      inputTokens: 0,
      cacheReadTokens: 0,
      outputTokens: 0,
      thinkingOutputTokens: 0,
      responseOutputTokens: 0,
      validSteps: [],
      stepsByNode: new Map(),
      maxCtxByNode: new Map(),
    });
  }

  const group = map.get(key);
  group.requestCount += 1;
  if (conversationId) {
    group.conversationIds.add(conversationId);
  }
  if (step.maxContextTokens > group.maxContextTokens) {
    group.maxContextTokens = step.maxContextTokens;
  }
  const nodeKey = step.trajectoryId || conversationId || 'root';
  if (step.maxContextTokens > (group.maxCtxByNode.get(nodeKey) || 0)) {
    group.maxCtxByNode.set(nodeKey, step.maxContextTokens);
  }
  group.inputTokens += step.inputTokens;
  group.cacheReadTokens += step.cacheReadTokens;
  group.outputTokens += step.outputTokens;
  group.thinkingOutputTokens += step.thinkingOutputTokens;
  group.responseOutputTokens += step.responseOutputTokens;
  if (isStepValidForE2E(step)) {
    group.validSteps.push(step);
    if (!group.stepsByNode.has(nodeKey)) {
      group.stepsByNode.set(nodeKey, []);
    }
    group.stepsByNode.get(nodeKey).push(step);
  }
}

export function finalizeModelGroupEntries(
  map,
  { sumAcrossNodes = false } = {}
) {
  return Array.from(map.values())
    .map((g) => {
      const tp = sumAcrossNodes
        ? sumThroughputWindowSummaries(
            Array.from(g.stepsByNode.values()).map((steps) =>
              computeThroughputWindowSummary(steps)
            )
          )
        : computeThroughputWindowSummary(g.validSteps);
      const totalPrompt = g.inputTokens + g.cacheReadTokens;
      const effectiveMaxCtx =
        sumAcrossNodes && g.maxCtxByNode.size > 0
          ? Array.from(g.maxCtxByNode.values()).reduce((a, b) => a + b, 0)
          : g.maxContextTokens;
      return {
        modelDisplayName: g.modelDisplayName,
        responseModel: g.responseModel,
        configuredModelId: g.configuredModelId,
        modelEnum: g.modelEnum,
        apiProvider: g.apiProvider,
        remainingQuotaFraction: g.remainingQuotaFraction,
        quotaResetTime: g.quotaResetTime,
        maxContextTokens: effectiveMaxCtx,
        requestCount: g.requestCount,
        conversationCount: g.conversationIds.size,
        validSampleCount: tp.sampleCount,
        inputTokens: g.inputTokens,
        cacheReadTokens: g.cacheReadTokens,
        totalPromptTokens: totalPrompt,
        cacheHitRate: totalPrompt > 0 ? g.cacheReadTokens / totalPrompt : 0,
        outputTokens: g.outputTokens,
        thinkingOutputTokens: g.thinkingOutputTokens,
        responseOutputTokens: g.responseOutputTokens,
        weightedStreamingTokPerSec: tp.weightedStreamingTokPerSec,
        meanStreamingTokPerSec: tp.meanStreamingTokPerSec,
        weightedE2ETokPerSec: tp.weightedE2ETokPerSec,
        meanE2ETokPerSec: tp.meanE2ETokPerSec,
        meanTtftSec: tp.meanTtftSec,
      };
    })
    .sort((a, b) => b.requestCount - a.requestCount);
}

export function aggregateScopedTokensAndModels(
  chatStepRecords,
  validThroughputSteps,
  { sumAcrossNodes = false } = {}
) {
  let totalInputTokens = 0;
  let totalCacheReadTokens = 0;
  let totalCacheWriteTokens = 0;
  let totalOutputTokens = 0;
  let totalThinkingOutputTokens = 0;
  let totalResponseOutputTokens = 0;
  let totalRetryCount = 0;
  const modelGroupsMap = new Map();

  for (const step of chatStepRecords) {
    totalInputTokens += step.inputTokens;
    totalCacheReadTokens += step.cacheReadTokens;
    totalCacheWriteTokens += step.cacheWriteTokens;
    totalOutputTokens += step.outputTokens;
    totalThinkingOutputTokens += step.thinkingOutputTokens;
    totalResponseOutputTokens += step.responseOutputTokens;
    totalRetryCount += step.retryCount;

    if (
      step.responseModel === 'unspecified' &&
      step.inputTokens === 0 &&
      step.outputTokens === 0
    ) {
      continue;
    }

    accumulateStepIntoModelGroup(modelGroupsMap, step);
  }

  const totalPromptTokens = totalInputTokens + totalCacheReadTokens;
  const cacheHitRate =
    totalPromptTokens > 0 ? totalCacheReadTokens / totalPromptTokens : 0;
  const modelsUsed = finalizeModelGroupEntries(modelGroupsMap, {
    sumAcrossNodes,
  });

  return {
    tokenTotals: {
      totalRequests: chatStepRecords.length,
      validThroughputRequests: validThroughputSteps.length,
      totalRetryCount,
      totalInputTokens,
      totalCacheReadTokens,
      totalCacheWriteTokens,
      totalPromptTokens,
      cacheHitRate,
      totalOutputTokens,
      totalThinkingOutputTokens,
      totalResponseOutputTokens,
      grandTotalTokens: totalPromptTokens + totalOutputTokens,
    },
    modelsUsed,
  };
}

export function buildThroughputPayload(
  validThroughputSteps,
  recentWindowSize,
  { activeScope = 'root', selectedNodeEntries = [] } = {}
) {
  const latestValidStep =
    validThroughputSteps.length > 0
      ? validThroughputSteps[validThroughputSteps.length - 1]
      : null;

  if (activeScope === 'tree' && selectedNodeEntries.length > 1) {
    const overallSummaries = [];
    const recentSummaries = [];
    let latestE2ESum = 0;
    let latestStreamingSum = 0;
    let latestOutTokSum = 0;
    let latestThinkTokSum = 0;
    let latestRespTokSum = 0;

    for (const entry of selectedNodeEntries) {
      const nodeSteps = Array.isArray(entry.validStepRecords)
        ? entry.validStepRecords
        : (entry.chatStepRecords || []).filter(isStepValidForE2E);
      if (nodeSteps.length === 0) continue;
      overallSummaries.push(computeThroughputWindowSummary(nodeSteps));
      recentSummaries.push(
        computeThroughputWindowSummary(nodeSteps.slice(-recentWindowSize))
      );
      const nodeLatest = nodeSteps[nodeSteps.length - 1];
      latestE2ESum += nodeLatest.e2eTokPerSec || 0;
      latestStreamingSum += nodeLatest.streamingTokPerSec || 0;
      latestOutTokSum += nodeLatest.outputTokens || 0;
      latestThinkTokSum += nodeLatest.thinkingOutputTokens || 0;
      latestRespTokSum += nodeLatest.responseOutputTokens || 0;
    }

    return {
      recentWindowSize,
      latest: latestValidStep
        ? {
            stepIndices: latestValidStep.stepIndices,
            trajectoryId: latestValidStep.trajectoryId,
            isSubagent: latestValidStep.isSubagent,
            nestingDepth: latestValidStep.nestingDepth,
            agentName: latestValidStep.agentName,
            agentRole: latestValidStep.agentRole,
            modelDisplayName: latestValidStep.modelDisplayName,
            responseModel: latestValidStep.responseModel,
            outputTokens: latestOutTokSum,
            thinkingOutputTokens: latestThinkTokSum,
            responseOutputTokens: latestRespTokSum,
            timeToFirstTokenSec: latestValidStep.timeToFirstTokenSec,
            streamingDurationSec: latestValidStep.streamingDurationSec,
            totalDurationSec: latestValidStep.totalDurationSec,
            streamingTokPerSec: latestStreamingSum,
            e2eTokPerSec: latestE2ESum,
          }
        : null,
      recentWindow: sumThroughputWindowSummaries(recentSummaries),
      sessionOverall: sumThroughputWindowSummaries(overallSummaries),
    };
  }

  const recentValidSteps = validThroughputSteps.slice(-recentWindowSize);

  return {
    recentWindowSize,
    latest: latestValidStep
      ? {
          stepIndices: latestValidStep.stepIndices,
          trajectoryId: latestValidStep.trajectoryId,
          isSubagent: latestValidStep.isSubagent,
          nestingDepth: latestValidStep.nestingDepth,
          agentName: latestValidStep.agentName,
          agentRole: latestValidStep.agentRole,
          modelDisplayName: latestValidStep.modelDisplayName,
          responseModel: latestValidStep.responseModel,
          outputTokens: latestValidStep.outputTokens,
          thinkingOutputTokens: latestValidStep.thinkingOutputTokens,
          responseOutputTokens: latestValidStep.responseOutputTokens,
          timeToFirstTokenSec: latestValidStep.timeToFirstTokenSec,
          streamingDurationSec: latestValidStep.streamingDurationSec,
          totalDurationSec: latestValidStep.totalDurationSec,
          streamingTokPerSec: latestValidStep.streamingTokPerSec,
          e2eTokPerSec: latestValidStep.e2eTokPerSec,
        }
      : null,
    recentWindow: computeThroughputWindowSummary(recentValidSteps),
    sessionOverall: computeThroughputWindowSummary(validThroughputSteps),
  };
}
