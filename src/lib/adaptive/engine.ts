/* Adaptive screening engine (POSDP-inspired, online + test-agnostic).
 * No deep nets, uses conjugate posteriors and bandit-style selection.
 */

export type StimulusMetadata = {
  difficulty: number; // relative scale per test (any positive range)
  subskill?: string; // e.g., "red_green", "small_optotype"
  presentation_params?: Record<string, unknown>;
};

export type ObservationRecord = {
  user_id: string;
  session_id: string;
  test_id: string;
  stimulus_id: string;
  stimulus_metadata: StimulusMetadata;
  response: {
    correct: boolean;
    response_time_ms: number;
    click_count: number;
    answer_changed: boolean;
  };
  timestamp: number;
};

export type StimulusDefinition = {
  testId: string;
  stimulusId: string;
  metadata: StimulusMetadata;
};

type PosteriorBeta = { alpha: number; beta: number };

class RunningStats {
  count = 0;
  mean = 0;
  m2 = 0;

  add(value: number) {
    this.count += 1;
    const delta = value - this.mean;
    this.mean += delta / this.count;
    const delta2 = value - this.mean;
    this.m2 += delta * delta2;
  }

  variance() {
    return this.count > 1 ? this.m2 / (this.count - 1) : 0;
  }
}

class RollingWindow {
  private values: number[] = [];
  constructor(private capacity: number) {}

  push(value: number) {
    this.values.push(value);
    if (this.values.length > this.capacity) {
      this.values.shift();
    }
  }

  mean() {
    if (!this.values.length) return 0;
    return this.values.reduce((s, v) => s + v, 0) / this.values.length;
  }

  valuesSnapshot() {
    return [...this.values];
  }
}

type SubskillState = {
  posterior: PosteriorBeta;
  timeStats: RunningStats;
  clickStats: RunningStats;
  answerChangeRate: RollingWindow;
  accuracyWindow: RollingWindow;
  fatigueScore: number;
  lastTimestamp: number | null;
};

type TestState = {
  accuracyWindow: RollingWindow;
  responseWindow: RollingWindow;
  lastDifficulty: number | null;
};

type ClusterStats = {
  subskill: string;
  difficultyBucket: number;
  count: number;
  avgResponseMs: number;
};

class ErrorClusterer {
  private clusters = new Map<string, ClusterStats>();
  constructor(private bucketSize = 1) {}

  add(subskill: string, difficulty: number, responseMs: number) {
    const difficultyBucket = Math.floor(difficulty / this.bucketSize);
    const key = `${subskill}|${difficultyBucket}`;
    const existing = this.clusters.get(key);
    if (!existing) {
      this.clusters.set(key, { subskill, difficultyBucket, count: 1, avgResponseMs: responseMs });
      return;
    }
    const nextCount = existing.count + 1;
    const nextAvg = existing.avgResponseMs + (responseMs - existing.avgResponseMs) / nextCount;
    this.clusters.set(key, { ...existing, count: nextCount, avgResponseMs: nextAvg });
  }

  topMistakeBuckets(limit = 3) {
    return [...this.clusters.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }
}

type UserModel = {
  subskills: Map<string, SubskillState>;
  tests: Map<string, TestState>;
  interactionStyle: RunningStats;
  fatigue: number;
};

type NextAction = {
  next_action: {
    test_id: string;
    stimulus_id: string;
    difficulty: number;
  } | null;
  confidence_vector: Record<string, number>;
  uncertainty_score: number;
  session_status: "continue" | "inconclusive" | "stop";
  screening_outcome: "normal" | "inconclusive" | "recommend_professional_check";
};

type EngineConfig = {
  priorAlpha?: number;
  priorBeta?: number;
  fatigueDecay?: number;
  fatigueGain?: number;
  uncertaintyStop?: number;
  fatigueStop?: number;
  explorationWeight?: number;
  difficultyBucketSize?: number;
};

export class AdaptiveEngine {
  private users = new Map<string, UserModel>();
  private tests = new Map<string, { stimuli: StimulusDefinition[]; maxDifficulty: number }>();
  private clusterer: ErrorClusterer;
  private config: Required<EngineConfig>;

  constructor(config: EngineConfig = {}) {
    this.config = {
      priorAlpha: config.priorAlpha ?? 2,
      priorBeta: config.priorBeta ?? 2,
      fatigueDecay: config.fatigueDecay ?? 0.97,
      fatigueGain: config.fatigueGain ?? 0.12,
      uncertaintyStop: config.uncertaintyStop ?? 0.04,
      fatigueStop: config.fatigueStop ?? 0.7,
      explorationWeight: config.explorationWeight ?? 0.5,
      difficultyBucketSize: config.difficultyBucketSize ?? 1,
    };
    this.clusterer = new ErrorClusterer(this.config.difficultyBucketSize);
  }

  registerTest(testId: string, stimuli: StimulusDefinition[]) {
    if (!stimuli.length) return;
    const maxDifficulty = stimuli.reduce((m, s) => Math.max(m, s.metadata.difficulty), 0) || 1;
    this.tests.set(testId, { stimuli, maxDifficulty });
  }

  ingestObservation(record: ObservationRecord) {
    const user = this.ensureUser(record.user_id);
    const subskillKey = record.stimulus_metadata.subskill ?? "global";
    const subskillState = this.ensureSubskill(user, subskillKey);
    const testState = this.ensureTest(user, record.test_id);

    const correct = record.response.correct ? 1 : 0;
    subskillState.posterior.alpha += correct;
    subskillState.posterior.beta += 1 - correct;

    subskillState.timeStats.add(record.response.response_time_ms);
    subskillState.clickStats.add(record.response.click_count);
    subskillState.answerChangeRate.push(record.response.answer_changed ? 1 : 0);
    subskillState.accuracyWindow.push(correct);
    testState.accuracyWindow.push(correct);
    testState.responseWindow.push(record.response.response_time_ms);
    testState.lastDifficulty = record.stimulus_metadata.difficulty;

    const fatigueIncrement = this.computeFatigueDelta(subskillState, record.response);
    subskillState.fatigueScore = subskillState.fatigueScore * this.config.fatigueDecay + fatigueIncrement;
    user.fatigue = Math.max(user.fatigue * this.config.fatigueDecay, subskillState.fatigueScore);
    subskillState.lastTimestamp = record.timestamp;
    user.interactionStyle.add(record.response.response_time_ms);

    if (!record.response.correct) {
      this.clusterer.add(
        subskillKey,
        record.stimulus_metadata.difficulty,
        record.response.response_time_ms,
      );
    }

    return this.getUserSnapshot(record.user_id);
  }

  selectNextAction(userId: string, allowedTests?: string[]): NextAction {
    const user = this.ensureUser(userId);
    const confidenceVector = this.buildConfidenceVector(user);
    const uncertaintyScore = this.computeUncertainty(user);

    const session_status =
      user.fatigue > this.config.fatigueStop
        ? "stop"
        : uncertaintyScore < this.config.uncertaintyStop
          ? "inconclusive"
          : "continue";

    const targetSubskill = this.mostUncertainSubskill(user);
    const candidates = this.buildCandidateSet(allowedTests ?? [...this.tests.keys()], targetSubskill);
    const next = this.rankCandidates(user, candidates, targetSubskill);

    const screening_outcome =
      uncertaintyScore < this.config.uncertaintyStop
        ? "inconclusive"
        : this.recommendation(user, confidenceVector);

    return {
      next_action: next,
      confidence_vector: confidenceVector,
      uncertainty_score: uncertaintyScore,
      session_status,
      screening_outcome,
    };
  }

  private ensureUser(userId: string): UserModel {
    if (!this.users.has(userId)) {
      this.users.set(userId, {
        subskills: new Map(),
        tests: new Map(),
        interactionStyle: new RunningStats(),
        fatigue: 0,
      });
    }
    return this.users.get(userId)!;
  }

  private ensureSubskill(user: UserModel, key: string): SubskillState {
    if (!user.subskills.has(key)) {
      user.subskills.set(key, {
        posterior: { alpha: this.config.priorAlpha, beta: this.config.priorBeta },
        timeStats: new RunningStats(),
        clickStats: new RunningStats(),
        answerChangeRate: new RollingWindow(20),
        accuracyWindow: new RollingWindow(20),
        fatigueScore: 0,
        lastTimestamp: null,
      });
    }
    return user.subskills.get(key)!;
  }

  private ensureTest(user: UserModel, testId: string): TestState {
    if (!user.tests.has(testId)) {
      user.tests.set(testId, {
        accuracyWindow: new RollingWindow(20),
        responseWindow: new RollingWindow(20),
        lastDifficulty: null,
      });
    }
    return user.tests.get(testId)!;
  }

  private computeFatigueDelta(subskill: SubskillState, response: ObservationRecord["response"]) {
    const slow = response.response_time_ms > (subskill.timeStats.mean || 1) * 1.3;
    const highClicks = response.click_count > (subskill.clickStats.mean || 1) * 1.3;
    const base = slow || highClicks ? 0.5 : 0.1;
    return base * this.config.fatigueGain;
  }

  private buildConfidenceVector(user: UserModel) {
    const vector: Record<string, number> = {};
    user.subskills.forEach((state, key) => {
      const total = state.posterior.alpha + state.posterior.beta;
      vector[key] = total ? state.posterior.alpha / total : 0.5;
    });
    return vector;
  }

  private computeUncertainty(user: UserModel) {
    const variances: number[] = [];
    user.subskills.forEach((state) => {
      const a = state.posterior.alpha;
      const b = state.posterior.beta;
      const denom = (a + b) ** 2 * (a + b + 1);
      const variance = denom ? (a * b) / denom : 0.25;
      variances.push(variance);
    });
    if (!variances.length) return 1;
    const meanVar = variances.reduce((s, v) => s + v, 0) / variances.length;
    return meanVar;
  }

  private mostUncertainSubskill(user: UserModel) {
    let target = "global";
    let best = -Infinity;
    user.subskills.forEach((state, key) => {
      const a = state.posterior.alpha;
      const b = state.posterior.beta;
      const denom = (a + b) ** 2 * (a + b + 1);
      const variance = denom ? (a * b) / denom : 0.25;
      const score = variance + state.fatigueScore * 0.2;
      if (score > best) {
        best = score;
        target = key;
      }
    });
    return target;
  }

  private buildCandidateSet(testIds: string[], targetSubskill: string) {
    const clusters = this.clusterer.topMistakeBuckets();
    const hotSubskill = clusters.find((c) => c.subskill === targetSubskill);

    const candidates: {
      testId: string;
      stimulus: StimulusDefinition;
      maxDifficulty: number;
    }[] = [];

    testIds.forEach((tid) => {
      const def = this.tests.get(tid);
      if (!def) return;
      def.stimuli.forEach((stimulus) => {
        if (stimulus.metadata.subskill && stimulus.metadata.subskill !== targetSubskill) return;
        candidates.push({ testId: tid, stimulus, maxDifficulty: def.maxDifficulty });
      });
    });

    if (candidates.length) return candidates;

    // Fallback: any stimuli from allowed tests.
    testIds.forEach((tid) => {
      const def = this.tests.get(tid);
      if (!def) return;
      def.stimuli.forEach((stimulus) => {
        candidates.push({ testId: tid, stimulus, maxDifficulty: def.maxDifficulty });
      });
    });

    // If hot cluster exists, prefer that subskill by tagging difficulty close to bucket.
    if (hotSubskill) {
      return candidates.sort((a, b) => {
        const da = Math.abs(a.stimulus.metadata.difficulty - hotSubskill.difficultyBucket);
        const db = Math.abs(b.stimulus.metadata.difficulty - hotSubskill.difficultyBucket);
        return da - db;
      });
    }

    return candidates;
  }

  private rankCandidates(
    user: UserModel,
    candidates: { testId: string; stimulus: StimulusDefinition; maxDifficulty: number }[],
    targetSubskill: string,
  ): NextAction["next_action"] {
    if (!candidates.length) return null;
    const state = this.ensureSubskill(user, targetSubskill);
    const ability = this.posteriorMean(state.posterior);
    const abilityVar = this.posteriorVar(state.posterior);

    let bestScore = -Infinity;
    let best: NextAction["next_action"] = null;

    candidates.forEach(({ testId, stimulus, maxDifficulty }) => {
      const normDifficulty = maxDifficulty ? stimulus.metadata.difficulty / maxDifficulty : stimulus.metadata.difficulty;
      const gap = Math.abs(normDifficulty - ability);
      const infoGain = 1 - Math.tanh(gap * gap);
      const exploration = this.config.explorationWeight * Math.sqrt(abilityVar);
      const fatiguePenalty = user.fatigue * 0.2;
      const score = infoGain + exploration - fatiguePenalty;
      if (score > bestScore) {
        bestScore = score;
        best = { test_id: testId, stimulus_id: stimulus.stimulusId, difficulty: stimulus.metadata.difficulty };
      }
    });

    return best;
  }

  private recommendation(user: UserModel, confidence: Record<string, number>): NextAction["screening_outcome"] {
    const lowConfidence = Object.values(confidence).some((v) => v < 0.4);
    const mixed = Object.values(confidence).some((v) => v > 0.8) && Object.values(confidence).some((v) => v < 0.5);
    if (user.fatigue > this.config.fatigueStop || mixed) return "inconclusive";
    if (lowConfidence) return "recommend_professional_check";
    return "normal";
  }

  private posteriorMean(posterior: PosteriorBeta) {
    const total = posterior.alpha + posterior.beta;
    return total ? posterior.alpha / total : 0.5;
  }

  private posteriorVar(posterior: PosteriorBeta) {
    const a = posterior.alpha;
    const b = posterior.beta;
    const denom = (a + b) ** 2 * (a + b + 1);
    return denom ? (a * b) / denom : 0.25;
  }

  private getUserSnapshot(userId: string) {
    const user = this.ensureUser(userId);
    return {
      subskills: [...user.subskills.entries()].map(([key, state]) => ({
        key,
        mean: this.posteriorMean(state.posterior),
        variance: this.posteriorVar(state.posterior),
        fatigue: state.fatigueScore,
      })),
      fatigue: user.fatigue,
      interactionMeanMs: user.interactionStyle.mean,
    };
  }
}

// Example usage flow (wire this into your test harness or service layer):
export function exampleAdaptiveFlow() {
  const engine = new AdaptiveEngine();

  // Register Ishihara stimuli (simplified)
  engine.registerTest("ishihara", [
    { testId: "ishihara", stimulusId: "plate_02", metadata: { difficulty: 0.3, subskill: "red_green" } },
    { testId: "ishihara", stimulusId: "plate_03", metadata: { difficulty: 0.35, subskill: "protanopia" } },
    { testId: "ishihara", stimulusId: "plate_12", metadata: { difficulty: 0.45, subskill: "deutanopia" } },
    { testId: "ishihara", stimulusId: "plate_20", metadata: { difficulty: 0.6, subskill: "diagnostic_red_green" } },
  ]);

  // Register Visual Acuity stimuli (levels 1-8)
  engine.registerTest("visual_acuity", Array.from({ length: 8 }).map((_, idx) => ({
    testId: "visual_acuity",
    stimulusId: `acuity_${idx + 1}`,
    metadata: { difficulty: idx + 1, subskill: "small_optotype" },
  })));

  // Simulate a session
  const userId = "demo-user";
  const sessionId = "session-1";
  const obs: ObservationRecord = {
    user_id: userId,
    session_id: sessionId,
    test_id: "ishihara",
    stimulus_id: "plate_02",
    stimulus_metadata: { difficulty: 0.3, subskill: "red_green" },
    response: {
      correct: false,
      response_time_ms: 5200,
      click_count: 1,
      answer_changed: false,
    },
    timestamp: Date.now(),
  };

  engine.ingestObservation(obs);
  const decision = engine.selectNextAction(userId, ["ishihara", "visual_acuity"]);
  return decision;
}
