import { access, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { IAuditResult } from "../puppeteer/injector.js";

const CURRENT_DIR = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(CURRENT_DIR, "..", "..");

const MAX_VIOLATIONS = 50;

const SEVERITY_WEIGHT: Record<string, number> = {
  critical: 0,
  high: 1,
  low: 2,
};

let translations: Record<string, { value: string }> | null = null;

async function loadTranslations(): Promise<Record<string, { value: string }>> {
  if (translations !== null) {
    return translations;
  }

  const candidates = [
    join(PROJECT_ROOT, "vendor", "translations", "en-us.json"),
    join(PROJECT_ROOT, "..", "auditor", "app", "translations", "en-us.json"),
  ];

  for (const candidate of candidates) {
    try {
      await access(candidate);
      const raw = await readFile(candidate, "utf-8");
      translations = JSON.parse(raw) as Record<string, { value: string }>;
      return translations;
    } catch {
      // Try the next translation path.
    }
  }

  translations = {};
  return translations;
}

async function resolveMessage(
  translationId: string,
  params?: string[] | null,
): Promise<string> {
  const t = await loadTranslations();
  const entry = t[translationId];

  if (entry === undefined) {
    return translationId;
  }

  let message = entry.value;

  if (Array.isArray(params)) {
    for (let i = 0; i < params.length; i += 1) {
      message = message.replace(`%${i}`, params[i] as string);
    }
  }

  return message;
}

interface IViolationEntry {
  severity: string;
  ruleTitle: string;
  selector: string;
  messages: string[];
}

interface IViolationGroup {
  criterionNum: string;
  criterionTitle: string;
  level: string;
  entries: IViolationEntry[];
}

export interface IFormattedReport {
  summary: string;
  details: string;
  ruleCount: {
    violations: number;
    passed: number;
    skipped: number;
    manualChecks: number;
  };
  truncated: boolean;
  totalViolations: number;
  shownViolations: number;
}

function parseCriterionKey(key: string): number[] {
  return key.split(".").filter(Boolean).map(Number);
}

function compareCriteria(a: string, b: string): number {
  if (a === "other") {
    return 1;
  }
  if (b === "other") {
    return -1;
  }

  const aParts = parseCriterionKey(a);
  const bParts = parseCriterionKey(b);

  for (let i = 0; i < Math.max(aParts.length, bParts.length); i += 1) {
    const aVal = aParts[i] ?? 0;
    const bVal = bParts[i] ?? 0;

    if (aVal !== bVal) {
      return aVal - bVal;
    }
  }

  return 0;
}

function countBySeverity(
  entries: IViolationEntry[],
): Array<{ severity: string; count: number }> {
  const counts: Record<string, number> = {};

  for (const entry of entries) {
    counts[entry.severity] = (counts[entry.severity] ?? 0) + 1;
  }

  return Object.entries(counts)
    .sort(([a], [b]) => (SEVERITY_WEIGHT[a] ?? 99) - (SEVERITY_WEIGHT[b] ?? 99))
    .map(([severity, count]) => ({ severity, count }));
}

export async function formatAuditReport(
  result: IAuditResult,
): Promise<IFormattedReport> {
  if (result.error) {
    return {
      summary: `Audit failed: ${result.error}`,
      details: `Error: ${result.error}`,
      ruleCount: { violations: 0, passed: 0, skipped: 0, manualChecks: 0 },
      truncated: false,
      totalViolations: 0,
      shownViolations: 0,
    };
  }

  const report = result.report as Record<string, unknown>;
  const rules = report.rules as
    | Record<string, Record<string, unknown>>
    | undefined;
  const score = (report.score as number) ?? 0;

  const groups: Map<string, IViolationGroup> = new Map();
  let passedCount = 0;
  let skippedCount = 0;
  let manualCheckCount = 0;

  if (rules !== undefined) {
    for (const ruleKey of Object.keys(rules)) {
      const rule = rules[ruleKey] as Record<string, unknown>;
      const status = rule.status as Record<string, string> | undefined;
      const statusType = (status?.type as string) ?? "";
      const isManualCheck =
        statusType === "manual" ||
        statusType === "manual_check" ||
        statusType === "needs_manual_check" ||
        rule.manual === true ||
        rule.manualCheck === true;
      const ruleTitle = (rule.title as string) ?? ruleKey;
      const severity = (rule.severity as string) ?? "";
      const results = rule.results as
        | Array<Record<string, unknown>>
        | undefined;

      if (isManualCheck) {
        manualCheckCount += 1;
      } else if (statusType === "error" && Array.isArray(results)) {
        const stdMeta = rule.standardMetaData as
          | Record<string, unknown>
          | null
          | undefined;
        const stdConfig = stdMeta?.config as
          | Record<string, unknown>
          | null
          | undefined;
        const criterionNum = (stdConfig?.num as string) ?? 'other';
        const criterionTitle =
          (stdConfig?.title as string) ?? 'Non-WCAG Issues';
        const level = (stdConfig?.level as string) ?? "";

        for (const resultItem of results) {
          const messages = resultItem.messageTranslation as
            | Array<{
                messageTranslationId: string;
                messageTranslationParams?: string[] | null;
              }>
            | undefined;
          const element = resultItem.element as
            | Record<string, unknown>
            | undefined;
          const selector = (element?.cssSelector as string) ?? "";

          const messageTexts: string[] = [];

          if (Array.isArray(messages)) {
            for (const msg of messages) {
              const resolved = await resolveMessage(
                msg.messageTranslationId,
                msg.messageTranslationParams,
              );
              messageTexts.push(resolved);
            }
          }

          const entry: IViolationEntry = {
            severity,
            ruleTitle,
            selector,
            messages: messageTexts,
          };

          if (!groups.has(criterionNum)) {
            groups.set(criterionNum, {
              criterionNum,
              criterionTitle,
              level,
              entries: [],
            });
          }

          groups.get(criterionNum)?.entries.push(entry);
        }
      } else if (statusType === "passed") {
        passedCount += 1;
      } else if (statusType === "skip") {
        skippedCount += 1;
      }
    }
  }

  // Sort groups by criterion number
  const sortedGroups = [...groups.values()].sort((a, b) =>
    compareCriteria(a.criterionNum, b.criterionNum),
  );

  // Sort entries within each group by severity weight
  for (const group of sortedGroups) {
    group.entries.sort(
      (a, b) =>
        (SEVERITY_WEIGHT[a.severity] ?? 99) -
        (SEVERITY_WEIGHT[b.severity] ?? 99),
    );
  }

  const totalViolations = sortedGroups.reduce(
    (sum, group) => sum + group.entries.length,
    0,
  );

  // Flatten entries respecting group order, then truncate
  const allEntries: Array<
    IViolationEntry & {
      criterionNum: string;
      criterionTitle: string;
      level: string;
    }
  > = [];

  for (const group of sortedGroups) {
    const groupTotal = group.entries.length;
    const remainingBudget = MAX_VIOLATIONS - allEntries.length;

    if (remainingBudget <= 0) {
      break;
    }

    const takeFromGroup = Math.min(groupTotal, remainingBudget);

    for (let i = 0; i < takeFromGroup; i += 1) {
      const entry = group.entries[i]!;

      allEntries.push({
        ...entry,
        criterionNum: group.criterionNum,
        criterionTitle: group.criterionTitle,
        level: group.level,
      });
    }
  }

  const shownEntries = allEntries;
  const truncatedCount =
    totalViolations - MAX_VIOLATIONS > 0 ? totalViolations - MAX_VIOLATIONS : 0;
  const truncated = truncatedCount > 0;

  const summaryLines: string[] = [];

  summaryLines.push(`Score: ${score}`);
  summaryLines.push(
    `Violations: ${totalViolations}, Passed rules: ${passedCount}, Skipped: ${skippedCount}`,
  );

  if (totalViolations > 0) {
    summaryLines.push("");
    summaryLines.push("=== Violations by WCAG Success Criterion ===");

    for (const group of sortedGroups) {
      const levelStr =
        group.level !== "" ? ` [${group.level.toUpperCase()}]` : "";
      const sevBreakdown = countBySeverity(group.entries)
        .map((s) => `${s.severity}: ${s.count}`)
        .join(", ");

      summaryLines.push(
        `  ${group.criterionNum}${levelStr}: ${group.criterionTitle} — ${group.entries.length} violation(s)`,
      );
      summaryLines.push(`    Severity: ${sevBreakdown}`);
    }

    if (shownEntries.length > 0) {
      summaryLines.push("");
      summaryLines.push(`=== Top ${shownEntries.length} Violations ===`);

      let idx = 0;

      for (const entry of shownEntries) {
        idx += 1;
        const levelStr =
          entry.level !== "" ? ` [${entry.level.toUpperCase()}]` : "";
        const selectorStr = entry.selector !== "" ? ` (${entry.selector})` : "";

        summaryLines.push(
          `${idx}. [${entry.severity.toUpperCase()}] ${entry.criterionNum}${levelStr} — ${entry.ruleTitle}${selectorStr}`,
        );

        for (const msg of entry.messages) {
          summaryLines.push(`   ${msg}`);
        }
      }
    }

    if (truncated) {
      summaryLines.push("");
      summaryLines.push(
        `⚠ ${truncatedCount} more violations not shown. Use report ID to access full data.`,
      );
    }
  }

  return {
    summary: summaryLines.join("\n"),
    details: JSON.stringify(report, null, 2),
    ruleCount: {
      violations: totalViolations,
      passed: passedCount,
      skipped: skippedCount,
      manualChecks: manualCheckCount,
    },
    truncated,
    totalViolations,
    shownViolations: shownEntries.length,
  };
}
