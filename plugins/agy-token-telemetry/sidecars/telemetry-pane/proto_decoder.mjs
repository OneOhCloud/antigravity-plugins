/**
 * @fileoverview Zero-dependency Protobuf wire decoder and canonical normalizer
 * for Antigravity `CortexStepGeneratorMetadata` records stored in SQLite
 * `gen_metadata` tables or returned by `GetCascadeTrajectoryGeneratorMetadata`.
 */

const API_PROVIDER_ENUM_MAP = Object.freeze({
  0: 'API_PROVIDER_UNSPECIFIED',
  1: 'API_PROVIDER_INTERNAL',
  2: 'API_PROVIDER_OPENAI',
  3: 'API_PROVIDER_ANTHROPIC',
  4: 'API_PROVIDER_GOOGLE_VERTEX',
  5: 'API_PROVIDER_AZURE_OPENAI',
  6: 'API_PROVIDER_AWS_BEDROCK',
  24: 'API_PROVIDER_GOOGLE_GEMINI',
  25: 'API_PROVIDER_GOOGLE_EVERGREEN',
  26: 'API_PROVIDER_ANTHROPIC_VERTEX',
});

const MODEL_ENUM_FALLBACK_MAP = Object.freeze({
  1026: 'MODEL_PLACEHOLDER_M26',
  1318: 'MODEL_PLACEHOLDER_M318',
  1319: 'MODEL_PLACEHOLDER_M319',
  1320: 'MODEL_PLACEHOLDER_M320',
  1322: 'MODEL_PLACEHOLDER_M322',
  1400: 'MODEL_PLACEHOLDER_M400',
  1401: 'MODEL_PLACEHOLDER_M401',
  1402: 'MODEL_PLACEHOLDER_M402',
  1403: 'MODEL_PLACEHOLDER_M403',
  1404: 'MODEL_PLACEHOLDER_M404',
  1405: 'MODEL_PLACEHOLDER_M405',
  1417: 'MODEL_PLACEHOLDER_M417',
  1418: 'MODEL_PLACEHOLDER_M418',
  1419: 'MODEL_PLACEHOLDER_M419',
});

/**
 * Reads a base-128 varint as a BigInt from buffer starting at offset.
 * Using BigInt avoids 32-bit bitwise truncation on 64-bit protobuf integers.
 */
function readVarint(buffer, offset) {
  let result = 0n;
  let shift = 0n;
  let cursor = offset;

  while (cursor < buffer.length) {
    const byte = buffer[cursor];
    cursor += 1;
    result |= BigInt(byte & 0x7f) << shift;
    if ((byte & 0x80) === 0) {
      return { value: result, nextOffset: cursor };
    }
    shift += 7n;
    if (shift > 70n) {
      throw new Error(`Malformed protobuf varint at offset ${offset}`);
    }
  }
  throw new Error(`Unexpected EOF while reading varint at offset ${offset}`);
}

/**
 * Iterates over top-level protobuf wire fields of a message slice.
 */
function parseWireFields(buffer, start = 0, end = buffer.length) {
  const fields = [];
  let cursor = start;

  while (cursor < end) {
    const tagInfo = readVarint(buffer, cursor);
    cursor = tagInfo.nextOffset;
    const tag = Number(tagInfo.value >> 3n);
    const wireType = Number(tagInfo.value & 0x07n);

    if (tag <= 0) {
      break;
    }

    if (wireType === 0) {
      const valInfo = readVarint(buffer, cursor);
      cursor = valInfo.nextOffset;
      fields.push({ tag, wireType, value: valInfo.value });
    } else if (wireType === 1) {
      if (cursor + 8 > end) break;
      fields.push({ tag, wireType, value: buffer.subarray(cursor, cursor + 8) });
      cursor += 8;
    } else if (wireType === 2) {
      const lenInfo = readVarint(buffer, cursor);
      cursor = lenInfo.nextOffset;
      const length = Number(lenInfo.value);
      if (length < 0 || cursor + length > end) {
        break;
      }
      fields.push({
        tag,
        wireType,
        value: buffer.subarray(cursor, cursor + length),
      });
      cursor += length;
    } else if (wireType === 5) {
      if (cursor + 4 > end) break;
      fields.push({ tag, wireType, value: buffer.subarray(cursor, cursor + 4) });
      cursor += 4;
    } else {
      break;
    }
  }

  return fields;
}

function decodePackedVarints(buffer) {
  const values = [];
  let cursor = 0;
  while (cursor < buffer.length) {
    const info = readVarint(buffer, cursor);
    values.push(Number(info.value));
    cursor = info.nextOffset;
  }
  return values;
}

function decodeUtf8(buffer) {
  return Buffer.from(buffer).toString('utf-8');
}

function toSafeNonNegativeInt(bigIntVal) {
  // Protobuf negative int32/int64 (-1) is encoded as 10-byte unsigned varint.
  if (bigIntVal > 0x7fffffffffffffffn) {
    return Number(BigInt.asIntN(64, bigIntVal));
  }
  return Number(bigIntVal);
}

function decodeDurationSeconds(buffer) {
  let seconds = 0;
  let nanos = 0;
  for (const field of parseWireFields(buffer)) {
    if (field.tag === 1 && field.wireType === 0) {
      seconds = toSafeNonNegativeInt(field.value);
    } else if (field.tag === 2 && field.wireType === 0) {
      nanos = toSafeNonNegativeInt(field.value);
    }
  }
  return Math.max(0, seconds + nanos / 1e9);
}

function decodeStringMapEntry(buffer) {
  let key = '';
  let value = '';
  for (const field of parseWireFields(buffer)) {
    if (field.tag === 1 && field.wireType === 2) {
      key = decodeUtf8(field.value);
    } else if (field.tag === 2 && field.wireType === 2) {
      value = decodeUtf8(field.value);
    }
  }
  return { key, value };
}

function decodeModelUsageStats(buffer) {
  const usage = {
    modelEnumInt: 0,
    inputTokens: 0,
    outputTokens: 0,
    cacheWriteTokens: 0,
    cacheReadTokens: 0,
    apiProviderEnumInt: 0,
    apiProvider: '',
    messageId: '',
    thinkingOutputTokens: 0,
    responseOutputTokens: 0,
    responseId: '',
  };

  for (const field of parseWireFields(buffer)) {
    if (field.wireType === 0) {
      const num = Math.max(0, toSafeNonNegativeInt(field.value));
      switch (field.tag) {
        case 1:
          usage.modelEnumInt = num;
          break;
        case 2:
          usage.inputTokens = num;
          break;
        case 3:
          usage.outputTokens = num;
          break;
        case 4:
          usage.cacheWriteTokens = num;
          break;
        case 5:
          usage.cacheReadTokens = num;
          break;
        case 6:
          usage.apiProviderEnumInt = num;
          usage.apiProvider = API_PROVIDER_ENUM_MAP[num] || `API_PROVIDER_${num}`;
          break;
        case 9:
          usage.thinkingOutputTokens = num;
          break;
        case 10:
          usage.responseOutputTokens = num;
          break;
        default:
          break;
      }
    } else if (field.wireType === 2) {
      if (field.tag === 7) {
        usage.messageId = decodeUtf8(field.value);
      } else if (field.tag === 11) {
        usage.responseId = decodeUtf8(field.value);
      }
    }
  }

  return usage;
}

function decodeContextWindowMetadata(buffer) {
  const ctx = {
    estimatedTokensUsed: 0,
    maxContextTokens: 0,
    totalBreakdownTokens: 0,
    groups: [],
  };

  for (const field of parseWireFields(buffer)) {
    if (field.tag === 1 && field.wireType === 0) {
      ctx.estimatedTokensUsed = Math.max(0, toSafeNonNegativeInt(field.value));
    } else if (field.tag === 4 && field.wireType === 0) {
      ctx.maxContextTokens = Math.max(0, toSafeNonNegativeInt(field.value));
    } else if (field.tag === 3 && field.wireType === 2) {
      for (const bf of parseWireFields(field.value)) {
        if (bf.tag === 2 && bf.wireType === 0) {
          ctx.totalBreakdownTokens = Math.max(0, toSafeNonNegativeInt(bf.value));
        } else if (bf.tag === 1 && bf.wireType === 2) {
          let name = '';
          let totalTokens = 0;
          for (const gf of parseWireFields(bf.value)) {
            if (gf.tag === 1 && gf.wireType === 2) {
              name = decodeUtf8(gf.value);
            } else if (gf.tag === 2 && gf.wireType === 0) {
              totalTokens = Math.max(0, toSafeNonNegativeInt(gf.value));
            }
          }
          if (name) {
            ctx.groups.push({ name, totalTokens });
          }
        }
      }
    }
  }

  return ctx;
}

function decodeChatStartMetadata(buffer) {
  let checkpointIndex = -1;
  let contextWindowMetadata = null;

  for (const field of parseWireFields(buffer)) {
    if (field.tag === 2 && field.wireType === 0) {
      checkpointIndex = toSafeNonNegativeInt(field.value);
    } else if (field.tag === 10 && field.wireType === 2) {
      contextWindowMetadata = decodeContextWindowMetadata(field.value);
    }
  }

  return { checkpointIndex, contextWindowMetadata };
}

function decodeChatModelMetadata(buffer) {
  let modelEnumInt = 0;
  let usage = null;
  let chatStartMetadata = null;
  let timeToFirstTokenSec = 0;
  let streamingDurationSec = 0;
  let retryCount = 0;
  let responseModel = '';
  let modelDisplayName = '';
  const customMetadata = {};

  for (const field of parseWireFields(buffer)) {
    if (field.tag === 3 && field.wireType === 0) {
      modelEnumInt = toSafeNonNegativeInt(field.value);
    } else if (field.tag === 4 && field.wireType === 2) {
      usage = decodeModelUsageStats(field.value);
    } else if (field.tag === 9 && field.wireType === 2) {
      chatStartMetadata = decodeChatStartMetadata(field.value);
    } else if (field.tag === 11 && field.wireType === 2) {
      timeToFirstTokenSec = decodeDurationSeconds(field.value);
    } else if (field.tag === 12 && field.wireType === 2) {
      streamingDurationSec = decodeDurationSeconds(field.value);
    } else if (field.tag === 17 && field.wireType === 2) {
      retryCount += 1;
    } else if (field.tag === 19 && field.wireType === 2) {
      responseModel = decodeUtf8(field.value);
    } else if (field.tag === 20 && field.wireType === 2) {
      const { key, value } = decodeStringMapEntry(field.value);
      if (key) customMetadata[key] = value;
    } else if (field.tag === 21 && field.wireType === 2) {
      modelDisplayName = decodeUtf8(field.value);
    }
  }

  const resolvedModelEnum =
    customMetadata.model_enum ||
    MODEL_ENUM_FALLBACK_MAP[modelEnumInt] ||
    (modelEnumInt ? `MODEL_ENUM_${modelEnumInt}` : '');

  return {
    model: resolvedModelEnum,
    modelEnumInt,
    modelDisplayName,
    responseModel,
    usage: usage || {
      inputTokens: 0,
      outputTokens: 0,
      cacheWriteTokens: 0,
      cacheReadTokens: 0,
      thinkingOutputTokens: 0,
      responseOutputTokens: 0,
      apiProvider: '',
      messageId: '',
      responseId: '',
    },
    contextWindowMetadata: chatStartMetadata?.contextWindowMetadata || null,
    timeToFirstTokenSec,
    streamingDurationSec,
    retryCount,
    customMetadata,
  };
}

/**
 * Decodes a single `CortexStepGeneratorMetadata` protobuf binary buffer
 * (from SQLite `gen_metadata.data` hex or Buffer).
 */
export function decodeGeneratorMetadataProto(input) {
  const buffer = Buffer.isBuffer(input) ? input : Buffer.from(input, 'hex');
  const stepIndices = [];
  let executionId = '';
  let chatModel = null;
  let plannerMaxOutputTokens = 0;

  for (const field of parseWireFields(buffer)) {
    if (field.tag === 1 && field.wireType === 2) {
      chatModel = decodeChatModelMetadata(field.value);
    } else if (field.tag === 2) {
      if (field.wireType === 2) {
        stepIndices.push(...decodePackedVarints(field.value));
      } else if (field.wireType === 0) {
        stepIndices.push(toSafeNonNegativeInt(field.value));
      }
    } else if (field.tag === 3 && field.wireType === 2) {
      for (const pf of parseWireFields(field.value)) {
        if (pf.tag === 6 && pf.wireType === 0) {
          plannerMaxOutputTokens = toSafeNonNegativeInt(pf.value);
        }
      }
    } else if (field.tag === 4 && field.wireType === 2) {
      executionId = decodeUtf8(field.value);
    }
  }

  return normalizeStepRecord({
    stepIndices,
    executionId,
    chatModel,
    plannerMaxOutputTokens,
  });
}

/**
 * Parses a Protobuf JSON duration string such as `"8.233905167s"` into seconds.
 */
export function parseDurationStringSeconds(durationStr) {
  if (typeof durationStr === 'number' && Number.isFinite(durationStr)) {
    return Math.max(0, durationStr);
  }
  if (typeof durationStr !== 'string' || !durationStr.trim()) {
    return 0;
  }
  const trimmed = durationStr.trim();
  const match = trimmed.match(/^(-?\d+(?:\.\d+)?)s$/);
  if (!match) {
    const parsed = Number.parseFloat(trimmed);
    return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
  }
  return Math.max(0, Number.parseFloat(match[1]));
}

function toNonNegativeNumber(val) {
  if (typeof val === 'number' && Number.isFinite(val)) {
    return Math.max(0, val);
  }
  if (typeof val === 'string' && val.trim() !== '') {
    const parsed = Number(val);
    return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
  }
  return 0;
}

/**
 * Normalizes either an RPC JSON `generatorMetadata` item or a decoded protobuf
 * item into a uniform `GeneratorStepRecord` with pre-calculated `tok/s` rates.
 */
export function normalizeStepRecord(raw) {
  const stepIndices = Array.isArray(raw?.stepIndices)
    ? raw.stepIndices.map((n) => Number(n)).filter((n) => Number.isFinite(n))
    : [];
  const executionId = String(raw?.executionId || '');
  const cm = raw?.chatModel || null;

  if (!cm) {
    return {
      hasChatModel: false,
      stepIndices,
      firstStepIndex: stepIndices.length > 0 ? Math.min(...stepIndices) : -1,
      lastStepIndex: stepIndices.length > 0 ? Math.max(...stepIndices) : -1,
      executionId,
      plannerMaxOutputTokens: toNonNegativeNumber(raw?.plannerMaxOutputTokens),
    };
  }

  const rawUsage = cm.usage || {};
  const inputTokens = toNonNegativeNumber(rawUsage.inputTokens);
  const outputTokens = toNonNegativeNumber(rawUsage.outputTokens);
  const cacheWriteTokens = toNonNegativeNumber(rawUsage.cacheWriteTokens);
  const cacheReadTokens = toNonNegativeNumber(rawUsage.cacheReadTokens);
  const thinkingOutputTokens = toNonNegativeNumber(rawUsage.thinkingOutputTokens);
  const responseOutputTokens = toNonNegativeNumber(rawUsage.responseOutputTokens);

  const timeToFirstTokenSec =
    cm.timeToFirstTokenSec !== undefined
      ? toNonNegativeNumber(cm.timeToFirstTokenSec)
      : parseDurationStringSeconds(cm.timeToFirstToken);

  const streamingDurationSec =
    cm.streamingDurationSec !== undefined
      ? toNonNegativeNumber(cm.streamingDurationSec)
      : parseDurationStringSeconds(cm.streamingDuration);

  const totalDurationSec = timeToFirstTokenSec + streamingDurationSec;

  // A step is a valid multi-chunk streaming sample when streamingDurationSec >= 0.25s
  // and the implied rate is within physical bounds (<= 1000 tok/s), filtering out
  // single-packet tool_call flushes where streamingDuration is ~2-10ms.
  const rawStreamingRate =
    outputTokens > 0 && streamingDurationSec > 0
      ? outputTokens / streamingDurationSec
      : 0;
  const isSinglePacketFlush =
    outputTokens > 0 &&
    (streamingDurationSec < 0.35 || rawStreamingRate > 450);
  const isValidThroughputSample =
    outputTokens > 0 && !isSinglePacketFlush && streamingDurationSec >= 0.35;
  const streamingTokPerSec = isValidThroughputSample ? rawStreamingRate : 0;
  const responseStreamingTokPerSec =
    isValidThroughputSample && responseOutputTokens > 0
      ? responseOutputTokens / streamingDurationSec
      : 0;
  const e2eTokPerSec =
    outputTokens > 0 && totalDurationSec > 0
      ? outputTokens / totalDurationSec
      : 0;

  const rawCtx =
    cm.contextWindowMetadata ||
    cm.chatStartMetadata?.contextWindowMetadata ||
    null;
  const estimatedTokensUsed = toNonNegativeNumber(rawCtx?.estimatedTokensUsed);
  const maxContextTokens = toNonNegativeNumber(rawCtx?.maxContextTokens);
  const rawBreakdownGroups =
    rawCtx?.groups || rawCtx?.tokenBreakdown?.groups || [];
  const breakdownGroups = Array.isArray(rawBreakdownGroups)
    ? rawBreakdownGroups.map((g) => ({
        name: String(g?.name || ''),
        totalTokens: toNonNegativeNumber(g?.totalTokens),
      }))
    : [];

  const customMetadata =
    cm.customMetadata && typeof cm.customMetadata === 'object'
      ? { ...cm.customMetadata }
      : {};
  const modelEnum = String(
    cm.model || customMetadata.model_enum || rawUsage.model || 'UNKNOWN_MODEL'
  );
  const responseModel = String(cm.responseModel || '');
  const modelDisplayName = String(
    cm.modelDisplayName || responseModel || modelEnum
  );
  const apiProvider = String(rawUsage.apiProvider || '');
  const rawAttemptCount =
    typeof cm.retryCount === 'number'
      ? cm.retryCount
      : Array.isArray(cm.retryInfos)
        ? cm.retryInfos.length
        : 0;
  // retryInfos always includes attempt #1; actual retries are attempts beyond the first.
  const retryCount = Math.max(0, rawAttemptCount - 1);

  return {
    hasChatModel: true,
    stepIndices,
    firstStepIndex: stepIndices.length > 0 ? Math.min(...stepIndices) : -1,
    lastStepIndex: stepIndices.length > 0 ? Math.max(...stepIndices) : -1,
    executionId,
    modelDisplayName,
    responseModel: responseModel || 'unspecified',
    modelEnum,
    apiProvider: apiProvider || 'UNSPECIFIED',
    inputTokens,
    cacheReadTokens,
    cacheWriteTokens,
    totalPromptTokens: inputTokens + cacheReadTokens,
    outputTokens,
    thinkingOutputTokens,
    responseOutputTokens,
    timeToFirstTokenSec,
    streamingDurationSec,
    totalDurationSec,
    isSinglePacketFlush,
    isValidThroughputSample,
    streamingTokPerSec,
    responseStreamingTokPerSec,
    e2eTokPerSec,
    retryCount,
    estimatedTokensUsed,
    maxContextTokens,
    breakdownGroups,
    messageId: String(rawUsage.messageId || ''),
    responseId: String(rawUsage.responseId || ''),
    requestId: String(customMetadata.request_id || ''),
    customMetadata,
  };
}
