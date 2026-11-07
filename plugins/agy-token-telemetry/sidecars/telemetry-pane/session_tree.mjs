/**
 * @fileoverview Multi-surface conversation discovery, parent-chain normalization,
 * and DFS multi-level subagent tree assembly (`L1`, `L2`, ...).
 */

import { existsSync, readdirSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, join } from 'node:path';
import { decodeConversationSummaryProto } from './proto_decoder.mjs';
import {
  APP_SURFACES,
  getGeminiRootDir,
  readTrajectoryHierarchyFromSqlite,
  runSqliteJsonQuery,
} from './sqlite_rpc.mjs';

/**
 * Formats a human-readable label for a subagent node from its `agentRole`,
 * parent role context (for nested L2+ workers with generic roles), and `agentName`.
 */
export function buildSubagentDisplayTitle(node, parentNode = null) {
  const shortId = node.conversationId.slice(0, 8);
  const role = String(node.agentRole || '').trim();
  const agent = String(node.agentName || '').trim();
  const parentRole =
    parentNode && parentNode.isSubagent
      ? String(parentNode.agentRole || parentNode.displayTitle || '').trim()
      : '';

  if (role) {
    if (parentRole && parentRole.toLowerCase() !== role.toLowerCase()) {
      const parentFirstToken = parentRole.split(/\s+/)[0].toLowerCase();
      const childFirstToken = role.split(/\s+/)[0].toLowerCase();
      if (parentFirstToken && parentFirstToken !== childFirstToken) {
        return `${parentRole} · ${role}`;
      }
    }
    return role;
  }
  if (agent) {
    return parentRole ? `${parentRole} · ${agent}` : agent;
  }
  return node.title || `Subagent ${shortId}`;
}

/**
 * Resolves the tri-state lifecycle status (`'active' | 'completed' | 'inactive'`)
 * for a conversation or subagent node.
 */
export function resolveConversationLifecycleStatus(node) {
  if (!node) return 'inactive';
  const status = String(node.status || '').trim();
  const statusEnum = Number(node.statusEnum || 0);
  const notFullyIdle = Boolean(node.notFullyIdle);
  const killed = Boolean(node.killed);
  const terminationReason = Number(node.terminationReason || 0);
  const stepCount = Number(node.stepCount || node.requestCount || 0);

  if (
    status === 'CASCADE_RUN_STATUS_RUNNING' ||
    status === 'CASCADE_RUN_STATUS_BUSY' ||
    status === 'CASCADE_RUN_STATUS_CANCELING' ||
    statusEnum === 2 ||
    notFullyIdle
  ) {
    return 'active';
  }

  if (killed || terminationReason === 1 || terminationReason === 2) {
    return 'inactive';
  }

  if (status === 'CASCADE_RUN_STATUS_COMPLETED') {
    return 'completed';
  }

  if (node.isSubagent) {
    if (
      stepCount > 0 ||
      terminationReason === 4 ||
      terminationReason === 5 ||
      status === 'CASCADE_RUN_STATUS_IDLE'
    ) {
      return stepCount > 0 || terminationReason === 4 || terminationReason === 5
        ? 'completed'
        : 'inactive';
    }
    return 'inactive';
  }

  return 'inactive';
}

function toTruthySqliteBool(val) {
  return val === 1 || val === true || val === '1' || val === 'true';
}

export function normalizeWorkspaceUri(rawUri) {
  if (!rawUri || typeof rawUri !== 'string') return '';
  let trimmed = rawUri.trim();
  if (!trimmed) return '';
  if (!trimmed.startsWith('file://') && trimmed.startsWith('/')) {
    trimmed = `file://${trimmed}`;
  }
  return trimmed.replace(/\/+$/, '');
}

export function parseWorkspaceUriList(rawWorkspaceUris, fallbackUris = []) {
  const candidates = [];
  if (Array.isArray(rawWorkspaceUris)) {
    candidates.push(...rawWorkspaceUris);
  } else if (typeof rawWorkspaceUris === 'string' && rawWorkspaceUris.trim()) {
    const str = rawWorkspaceUris.trim();
    if (str.startsWith('[')) {
      try {
        const parsed = JSON.parse(str);
        if (Array.isArray(parsed)) {
          candidates.push(...parsed);
        }
      } catch {
        candidates.push(str);
      }
    } else {
      candidates.push(...str.split(','));
    }
  }
  if (Array.isArray(fallbackUris)) {
    candidates.push(...fallbackUris);
  }

  const normalized = [];
  for (const item of candidates) {
    const uri = normalizeWorkspaceUri(item);
    if (uri && !normalized.includes(uri)) {
      normalized.push(uri);
    }
  }
  return normalized;
}

export function deriveWorkspaceIdentity(
  workspaceUriList,
  surfaceId = '',
  projectId = ''
) {
  const primaryUri = Array.isArray(workspaceUriList)
    ? workspaceUriList[0] || ''
    : '';
  if (!primaryUri) {
    const isCli =
      surfaceId === 'antigravity-cli' || projectId === 'default-cli-project';
    return {
      workspaceName: isCli ? 'CLI' : 'Global',
      workspaceProjectKey: isCli ? 'cli' : '',
      worktreeBranch: '',
    };
  }

  const cleanPath = primaryUri.replace(/^file:\/\//, '');
  const worktreeMatch = cleanPath.match(
    /\/\.gemini\/antigravity\/worktrees\/([^/]+)\/([^/]+)$/
  );
  if (worktreeMatch) {
    return {
      workspaceName: worktreeMatch[1],
      workspaceProjectKey: worktreeMatch[1].toLowerCase(),
      worktreeBranch: worktreeMatch[2],
    };
  }

  const claudeWorktreeMatch = cleanPath.match(
    /\/([^/]+)\/\.claude\/worktrees\/([^/]+)$/
  );
  if (claudeWorktreeMatch) {
    return {
      workspaceName: claudeWorktreeMatch[1],
      workspaceProjectKey: claudeWorktreeMatch[1].toLowerCase(),
      worktreeBranch: claudeWorktreeMatch[2],
    };
  }

  const folderName = basename(cleanPath) || cleanPath;
  return {
    workspaceName: folderName,
    workspaceProjectKey: folderName.toLowerCase(),
    worktreeBranch: '',
  };
}

function cleanPreviewFallbackTitle(previewText) {
  if (!previewText || typeof previewText !== 'string') return '';
  const firstLine = previewText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find(Boolean);
  if (!firstLine) return '';
  return firstLine.length > 52 ? `${firstLine.slice(0, 52)}...` : firstLine;
}

function loadSurfaceSummaryNodes(surface, geminiRoot, byId) {
  const surfaceDir = join(geminiRoot, surface.id);
  const summaryDbPath = join(surfaceDir, 'conversation_summaries.db');
  const convDir = join(surfaceDir, 'conversations');

  const rows = runSqliteJsonQuery(
    summaryDbPath,
    `SELECT conversation_id, title, preview, step_count, last_modified_time,
            workspace_uris, status, not_fully_idle, killed, agent_name,
            parent_conversation_id, nesting_depth, hex(raw_summary) AS hex_raw_summary
     FROM conversation_summaries
     ORDER BY last_modified_time DESC;`
  );

  for (const row of rows) {
    const id = String(row.conversation_id || '').trim();
    if (!id) continue;
    const dbFilePath = join(convDir, `${id}.db`);
    if (!existsSync(dbFilePath)) continue;
    try {
      if (statSync(dbFilePath).size === 0) continue;
    } catch {
      continue;
    }

    const decodedSummary = decodeConversationSummaryProto(row.hex_raw_summary);
    const parentConversationId =
      String(row.parent_conversation_id || '').trim() ||
      decodedSummary.parentConversationId ||
      '';
    const nestingDepth = Math.max(
      Number(row.nesting_depth || 0),
      Number(decodedSummary.nestingDepth || 0),
      parentConversationId ? 1 : 0
    );
    const agentName =
      String(row.agent_name || '').trim() || decodedSummary.agentName || '';
    const agentRole = decodedSummary.agentRole || '';
    const preview = String(row.preview || '').trim();
    const rawTitle =
      String(row.title || '').trim() ||
      decodedSummary.title ||
      cleanPreviewFallbackTitle(preview);
    const isSubagent = Boolean(
      parentConversationId || nestingDepth > 0 || agentName || agentRole
    );
    const rootConversationId =
      decodedSummary.rootConversationId ||
      (isSubagent ? parentConversationId : id);
    const notFullyIdle =
      toTruthySqliteBool(row.not_fully_idle) || decodedSummary.notFullyIdle;
    const killed = toTruthySqliteBool(row.killed) || decodedSummary.killed;
    const projectId = decodedSummary.projectId || '';
    const workspaceUriList = parseWorkspaceUriList(
      row.workspace_uris,
      decodedSummary.workspaceUris
    );
    const wsIdentity = deriveWorkspaceIdentity(
      workspaceUriList,
      surface.id,
      projectId
    );

    const node = {
      conversationId: id,
      title: rawTitle || `会话 ${id.slice(0, 8)}`,
      preview,
      stepCount: Number(row.step_count || 0),
      lastModifiedTime: String(row.last_modified_time || ''),
      workspaceUris: String(row.workspace_uris || ''),
      workspaceUriList,
      workspaceName: wsIdentity.workspaceName,
      workspaceProjectKey: wsIdentity.workspaceProjectKey,
      worktreeBranch: wsIdentity.worktreeBranch,
      projectId,
      status: String(row.status || ''),
      statusEnum: decodedSummary.statusEnum || 0,
      notFullyIdle,
      killed,
      terminationReason: decodedSummary.terminationReason || 0,
      surfaceId: surface.id,
      surfaceLabel: surface.label,
      dbPath: dbFilePath,
      isSubagent,
      nestingDepth,
      parentConversationId,
      rootConversationId,
      agentName,
      agentRole,
    };
    node.displayTitle = isSubagent
      ? buildSubagentDisplayTitle(node)
      : node.title;
    node.lifecycleStatus = resolveConversationLifecycleStatus(node);
    byId.set(id, node);
  }
}

function loadSurfaceFallbackDbNodes(surface, geminiRoot, byId) {
  const convDir = join(geminiRoot, surface.id, 'conversations');
  if (!existsSync(convDir)) {
    return;
  }
  try {
    const files = readdirSync(convDir).filter((f) => f.endsWith('.db'));
    for (const file of files) {
      const id = basename(file, '.db');
      if (byId.has(id)) continue;

      const dbFilePath = join(convDir, file);
      let stat;
      try {
        stat = statSync(dbFilePath);
      } catch {
        continue;
      }
      if (stat.size === 0) continue;

      const fallbackHierarchy = readTrajectoryHierarchyFromSqlite(dbFilePath);
      const parentConversationId =
        fallbackHierarchy.parentConversationId || '';
      const nestingDepth = Math.max(
        Number(fallbackHierarchy.nestingDepth || 0),
        parentConversationId ? 1 : 0
      );
      const agentName = fallbackHierarchy.agentName || '';
      const agentRole = fallbackHierarchy.agentRole || '';
      const isSubagent = Boolean(
        parentConversationId || nestingDepth > 0 || agentName || agentRole
      );
      const rootConversationId =
        fallbackHierarchy.rootConversationId ||
        (isSubagent ? parentConversationId : id);
      const projectId = fallbackHierarchy.projectId || '';
      const workspaceUriList = parseWorkspaceUriList(
        fallbackHierarchy.workspaceUris
      );
      const wsIdentity = deriveWorkspaceIdentity(
        workspaceUriList,
        surface.id,
        projectId
      );

      const node = {
        conversationId: id,
        title: `会话 ${id.slice(0, 8)}`,
        preview: '',
        stepCount: 0,
        lastModifiedTime: stat.mtime.toISOString(),
        workspaceUris: workspaceUriList.length
          ? JSON.stringify(workspaceUriList)
          : '',
        workspaceUriList,
        workspaceName: wsIdentity.workspaceName,
        workspaceProjectKey: wsIdentity.workspaceProjectKey,
        worktreeBranch: wsIdentity.worktreeBranch,
        projectId,
        status: '',
        surfaceId: surface.id,
        surfaceLabel: surface.label,
        dbPath: dbFilePath,
        isSubagent,
        nestingDepth,
        parentConversationId,
        rootConversationId,
        agentName,
        agentRole,
      };
      node.displayTitle = isSubagent
        ? buildSubagentDisplayTitle(node)
        : node.title;
      node.lifecycleStatus = resolveConversationLifecycleStatus(node);
      byId.set(id, node);
    }
  } catch {
    // Ignore directory listing errors
  }
}

function normalizeParentChains(byId) {
  for (const node of byId.values()) {
    if (!node.isSubagent) {
      node.rootConversationId = node.conversationId;
      node.nestingDepth = 0;
      continue;
    }
    const visited = new Set([node.conversationId]);
    let cursor = node;
    let computedDepth = 0;
    while (
      cursor.parentConversationId &&
      byId.has(cursor.parentConversationId) &&
      !visited.has(cursor.parentConversationId)
    ) {
      visited.add(cursor.parentConversationId);
      cursor = byId.get(cursor.parentConversationId);
      computedDepth += 1;
    }
    if (!cursor.isSubagent) {
      node.rootConversationId = cursor.conversationId;
    } else if (
      node.rootConversationId &&
      byId.has(node.rootConversationId) &&
      !byId.get(node.rootConversationId).isSubagent
    ) {
      // Keep decoded rootConversationId
    } else {
      node.rootConversationId = cursor.conversationId;
    }
    if (computedDepth > node.nestingDepth) {
      node.nestingDepth = computedDepth;
    }
  }
}

function assembleRootSessionTrees(byId) {
  const childrenByParentId = new Map();
  const rootNodes = [];

  for (const node of byId.values()) {
    if (!node.isSubagent) {
      rootNodes.push(node);
      continue;
    }
    const effectiveParentId =
      node.parentConversationId && byId.has(node.parentConversationId)
        ? node.parentConversationId
        : node.rootConversationId && byId.has(node.rootConversationId)
          ? node.rootConversationId
          : '';

    if (!effectiveParentId || effectiveParentId === node.conversationId) {
      rootNodes.push({
        ...node,
        isSubagent: false,
        nestingDepth: 0,
      });
      continue;
    }

    if (!childrenByParentId.has(effectiveParentId)) {
      childrenByParentId.set(effectiveParentId, []);
    }
    childrenByParentId.get(effectiveParentId).push(node);
  }

  for (const siblings of childrenByParentId.values()) {
    siblings.sort((a, b) =>
      String(a.lastModifiedTime).localeCompare(String(b.lastModifiedTime))
    );
  }

  return rootNodes.map((rootNode) => {
    const subagents = [];
    const visitedSubIds = new Set([rootNode.conversationId]);
    let treeLastModifiedTime = String(rootNode.lastModifiedTime || '');
    let maxNestingDepth = 0;

    function dfsCollect(parentNode, parentDepth) {
      const children = childrenByParentId.get(parentNode.conversationId) || [];
      for (const child of children) {
        if (visitedSubIds.has(child.conversationId)) continue;
        visitedSubIds.add(child.conversationId);
        const effectiveDepth = Math.max(child.nestingDepth || 1, parentDepth + 1);
        const normalizedChild = {
          ...child,
          nestingDepth: effectiveDepth,
          rootConversationId: rootNode.conversationId,
          parentRole: parentNode.isSubagent
            ? String(parentNode.agentRole || parentNode.displayTitle || '').trim()
            : '',
        };
        normalizedChild.displayTitle = buildSubagentDisplayTitle(
          normalizedChild,
          parentNode
        );
        normalizedChild.lifecycleStatus =
          resolveConversationLifecycleStatus(normalizedChild);
        if (effectiveDepth > maxNestingDepth) {
          maxNestingDepth = effectiveDepth;
        }
        if (
          String(normalizedChild.lastModifiedTime).localeCompare(
            treeLastModifiedTime
          ) > 0
        ) {
          treeLastModifiedTime = String(normalizedChild.lastModifiedTime);
        }
        subagents.push(normalizedChild);
        dfsCollect(normalizedChild, effectiveDepth);
      }
    }

    dfsCollect(rootNode, 0);

    const rootOwnLifecycleStatus = resolveConversationLifecycleStatus(rootNode);
    const hasActiveSubagent = subagents.some(
      (s) => s.lifecycleStatus === 'active'
    );
    const allSubagentsCompleted =
      subagents.length > 0 &&
      subagents.every((s) => s.lifecycleStatus === 'completed');
    const lifecycleStatus =
      rootOwnLifecycleStatus === 'active' || hasActiveSubagent
        ? 'active'
        : rootOwnLifecycleStatus;
    const treeLifecycleStatus =
      lifecycleStatus === 'active'
        ? 'active'
        : allSubagentsCompleted
          ? 'completed'
          : rootOwnLifecycleStatus;

    return {
      ...rootNode,
      lifecycleStatus,
      rootOwnLifecycleStatus,
      treeLifecycleStatus,
      treeLastModifiedTime,
      subagentCount: subagents.length,
      maxNestingDepth,
      subagents,
    };
  });
}

/**
 * Discovers all conversations across `antigravity` (App) and `antigravity-cli` (CLI),
 * linking multi-level subagents (`L1`, `L2`, ...) to their root session in DFS order.
 */
export function listAvailableConversations({
  homeDirPath = homedir(),
  limit = 50,
} = {}) {
  const geminiRoot = getGeminiRootDir(homeDirPath);
  const byId = new Map();

  for (const surface of APP_SURFACES) {
    loadSurfaceSummaryNodes(surface, geminiRoot, byId);
    loadSurfaceFallbackDbNodes(surface, geminiRoot, byId);
  }

  normalizeParentChains(byId);
  const enrichedRoots = assembleRootSessionTrees(byId);

  return enrichedRoots
    .sort((a, b) =>
      String(b.treeLastModifiedTime).localeCompare(
        String(a.treeLastModifiedTime)
      )
    )
    .slice(0, limit);
}

/**
 * Filters global conversations down to those belonging to the current workspace,
 * while preserving the full global list for the Global panel.
 */
export function resolveWorkspaceScopedConversations(
  allConversations,
  { workspaceUris = [], requestedConversationId = '' } = {}
) {
  const list = Array.isArray(allConversations) ? allConversations : [];
  if (list.length === 0) {
    return {
      currentWorkspace: {
        name: 'Global',
        projectKey: '',
        uris: [],
        conversationCount: 0,
      },
      workspaceConversations: [],
      defaultConversationId: requestedConversationId || '',
    };
  }

  const explicitUris = parseWorkspaceUriList(workspaceUris);
  let matchedRequestedRoot = null;
  if (requestedConversationId) {
    matchedRequestedRoot =
      list.find((c) => c.conversationId === requestedConversationId) ||
      list.find((c) =>
        (c.subagents || []).some(
          (s) => s.conversationId === requestedConversationId
        )
      ) ||
      null;
  }

  let effectiveUris = explicitUris;
  let targetProjectId = '';
  let targetProjectKey = '';
  let workspaceName = '';

  if (effectiveUris.length > 0) {
    const wsId = deriveWorkspaceIdentity(effectiveUris);
    workspaceName = wsId.workspaceName;
    targetProjectKey = wsId.workspaceProjectKey;
    const uriMatchConv = list.find((c) =>
      (c.workspaceUriList || []).some((u) => effectiveUris.includes(u))
    );
    if (
      uriMatchConv?.projectId &&
      uriMatchConv.projectId !== 'default-cli-project'
    ) {
      targetProjectId = uriMatchConv.projectId;
    }
  } else {
    const anchorConv =
      matchedRequestedRoot ||
      list.find((c) => c.lifecycleStatus === 'active') ||
      list[0];
    effectiveUris = anchorConv?.workspaceUriList || [];
    targetProjectId =
      anchorConv?.projectId && anchorConv.projectId !== 'default-cli-project'
        ? anchorConv.projectId
        : '';
    targetProjectKey = anchorConv?.workspaceProjectKey || '';
    workspaceName = anchorConv?.workspaceName || 'Global';
  }

  let workspaceConversations = list.filter((conv) => {
    const convUris = conv.workspaceUriList || [];
    if (
      effectiveUris.length > 0 &&
      convUris.some((u) => effectiveUris.includes(u))
    ) {
      return true;
    }
    if (
      targetProjectId &&
      conv.projectId &&
      conv.projectId === targetProjectId
    ) {
      return true;
    }
    if (
      targetProjectKey &&
      targetProjectKey !== 'cli' &&
      conv.workspaceProjectKey === targetProjectKey
    ) {
      return true;
    }
    return false;
  });

  if (workspaceConversations.length === 0) {
    const fallbackConv = matchedRequestedRoot || list[0];
    workspaceConversations = fallbackConv ? [fallbackConv] : [];
  }

  const defaultConversationId =
    requestedConversationId ||
    workspaceConversations[0]?.conversationId ||
    list[0]?.conversationId ||
    '';

  return {
    currentWorkspace: {
      name:
        workspaceName ||
        workspaceConversations[0]?.workspaceName ||
        'Workspace',
      projectKey: targetProjectKey,
      uris: effectiveUris,
      conversationCount: workspaceConversations.length,
    },
    workspaceConversations,
    defaultConversationId,
  };
}
