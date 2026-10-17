"use client";

import * as React from "react";
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Copy,
  HelpCircle,
  Plus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { QuizOption, QuizQuestion, QuizQuestionType } from "@/lib/course-wizard";
import { cn } from "@/lib/utils";

function makeId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function createDefaultQuestion(
  type: QuizQuestionType = "multiple-choice"
): QuizQuestion {
  if (type === "true-false") {
    const trueOpt: QuizOption = { id: makeId("opt"), text: "True" };
    const falseOpt: QuizOption = { id: makeId("opt"), text: "False" };
    return {
      id: makeId("q"),
      type: "true-false",
      question: "",
      options: [trueOpt, falseOpt],
      correctOptionId: trueOpt.id,
      explanation: "",
      points: 1,
    };
  }

  const optA: QuizOption = { id: makeId("opt"), text: "" };
  const optB: QuizOption = { id: makeId("opt"), text: "" };
  const optC: QuizOption = { id: makeId("opt"), text: "" };
  return {
    id: makeId("q"),
    type: "multiple-choice",
    question: "",
    options: [optA, optB, optC],
    correctOptionId: optA.id,
    explanation: "",
    points: 1,
  };
}

export interface QuizValidationResult {
  valid: boolean;
  error: string | null;
  questionErrors: Record<string, string>;
}

export function validateQuizQuestions(
  questions: QuizQuestion[]
): QuizValidationResult {
  if (questions.length === 0) {
    return {
      valid: false,
      error: "Add at least one question before saving the quiz.",
      questionErrors: {},
    };
  }

  const questionErrors: Record<string, string> = {};
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const label = `Question ${i + 1}`;
    if (!q.question.trim()) {
      questionErrors[q.id] = `${label}: Enter the question prompt.`;
      continue;
    }
    if (q.options.length < 2) {
      questionErrors[q.id] = `${label}: Add at least 2 answer choices.`;
      continue;
    }
    const emptyOptionIndex = q.options.findIndex((opt) => !opt.text.trim());
    if (emptyOptionIndex !== -1) {
      questionErrors[q.id] = `${label}: Fill in text for Option ${String.fromCharCode(
        65 + emptyOptionIndex
      )}.`;
      continue;
    }
    const hasValidCorrect = q.options.some(
      (opt) => opt.id === q.correctOptionId && opt.text.trim().length > 0
    );
    if (!hasValidCorrect) {
      questionErrors[q.id] = `${label}: Select the correct answer choice.`;
    }
  }

  const firstError = Object.values(questionErrors)[0] ?? null;
  return {
    valid: firstError === null,
    error: firstError,
    questionErrors,
  };
}

interface QuizBuilderProps {
  questions: QuizQuestion[];
  onChange: (questions: QuizQuestion[]) => void;
  passingScorePercent: number;
  onPassingScoreChange: (percent: number) => void;
  questionErrors?: Record<string, string>;
  disabled?: boolean;
}

export function QuizBuilder({
  questions,
  onChange,
  passingScorePercent,
  onPassingScoreChange,
  questionErrors = {},
  disabled = false,
}: QuizBuilderProps) {
  const [collapsedIds, setCollapsedIds] = React.useState<Record<string, boolean>>({});

  function toggleCollapse(id: string) {
    setCollapsedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function updateQuestion(index: number, next: QuizQuestion) {
    const copy = [...questions];
    copy[index] = next;
    onChange(copy);
  }

  function addQuestion(type: QuizQuestionType) {
    const created = createDefaultQuestion(type);
    onChange([...questions, created]);
  }

  function duplicateQuestion(index: number) {
    const source = questions[index];
    if (!source) return;
    const optionMap = new Map<string, string>();
    const newOptions = source.options.map((opt) => {
      const nextId = makeId("opt");
      optionMap.set(opt.id, nextId);
      return { id: nextId, text: opt.text };
    });
    const duplicated: QuizQuestion = {
      ...source,
      id: makeId("q"),
      question: source.question ? `${source.question} (Copy)` : "",
      options: newOptions,
      correctOptionId:
        optionMap.get(source.correctOptionId) ?? newOptions[0]?.id ?? "",
    };
    const next = [...questions];
    next.splice(index + 1, 0, duplicated);
    onChange(next);
  }

  function removeQuestion(index: number) {
    onChange(questions.filter((_, i) => i !== index));
  }

  function moveQuestion(index: number, delta: -1 | 1) {
    const target = index + delta;
    if (target < 0 || target >= questions.length) return;
    const next = [...questions];
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved);
    onChange(next);
  }

  function handleTypeChange(index: number, newType: QuizQuestionType) {
    const current = questions[index];
    if (!current || current.type === newType) return;

    if (newType === "true-false") {
      const trueOpt: QuizOption = { id: makeId("opt"), text: "True" };
      const falseOpt: QuizOption = { id: makeId("opt"), text: "False" };
      updateQuestion(index, {
        ...current,
        type: "true-false",
        options: [trueOpt, falseOpt],
        correctOptionId: trueOpt.id,
      });
    } else {
      const optA: QuizOption = { id: makeId("opt"), text: "" };
      const optB: QuizOption = { id: makeId("opt"), text: "" };
      const optC: QuizOption = { id: makeId("opt"), text: "" };
      updateQuestion(index, {
        ...current,
        type: "multiple-choice",
        options: [optA, optB, optC],
        correctOptionId: optA.id,
      });
    }
  }

  const completedQuestionsCount = questions.filter((q) => {
    const hasPrompt = q.question.trim().length > 0;
    const hasOptions =
      q.options.length >= 2 && q.options.every((o) => o.text.trim().length > 0);
    const hasCorrect = q.options.some((o) => o.id === q.correctOptionId);
    return hasPrompt && hasOptions && hasCorrect;
  }).length;

  return (
    <div className="space-y-4">
      {/* Quiz Overview & Settings Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-lg bg-amber-100 text-amber-800">
            <HelpCircle className="size-4" aria-hidden="true" />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[13px] font-semibold text-foreground">
                Quiz questions &amp; grading
              </span>
              <Badge
                variant={
                  completedQuestionsCount === questions.length &&
                  questions.length > 0
                    ? "emerald"
                    : "amber"
                }
              >
                {completedQuestionsCount}/{questions.length}{" "}
                {questions.length === 1 ? "question" : "questions"} ready
              </Badge>
            </div>
            <p className="text-[11.5px] text-muted-foreground">
              Add multiple-choice or true/false questions and mark the correct answer for each.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <label
            htmlFor="quiz-passing-score"
            className="text-[12px] font-medium text-foreground"
          >
            Passing score (%)
          </label>
          <Input
            id="quiz-passing-score"
            type="number"
            min={0}
            max={100}
            disabled={disabled}
            value={passingScorePercent}
            onChange={(e) =>
              onPassingScoreChange(
                Math.max(0, Math.min(100, Number(e.target.value) || 0))
              )
            }
            className="h-8 w-20 bg-white text-center text-[12.5px]"
          />
        </div>
      </div>

      {/* Question Cards List */}
      {questions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/30 p-6 text-center">
          <HelpCircle
            className="mx-auto size-7 text-amber-600"
            aria-hidden="true"
          />
          <p className="mt-2 font-display text-[14px] font-semibold text-foreground">
            No questions in this quiz yet
          </p>
          <p className="mx-auto mt-1 max-w-md text-[12px] text-muted-foreground">
            Start building your quiz by adding a multiple-choice or true/false question below.
          </p>
          {!disabled ? (
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <Button
                type="button"
                size="sm"
                onClick={() => addQuestion("multiple-choice")}
              >
                <Plus className="size-3.5" aria-hidden="true" />
                Add multiple-choice question
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => addQuestion("true-false")}
              >
                <Plus className="size-3.5" aria-hidden="true" />
                Add true / false question
              </Button>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="space-y-3">
          {questions.map((q, qIndex) => {
            const qError = questionErrors[q.id];
            const isCollapsed = Boolean(collapsedIds[q.id]) && !qError;
            const correctOption = q.options.find(
              (opt) => opt.id === q.correctOptionId
            );
            const isQuestionComplete =
              q.question.trim().length > 0 &&
              q.options.length >= 2 &&
              q.options.every((opt) => opt.text.trim().length > 0) &&
              Boolean(correctOption);

            return (
              <div
                key={q.id}
                className={cn(
                  "rounded-xl border bg-white shadow-2xs transition-colors",
                  qError
                    ? "border-red-300"
                    : isQuestionComplete
                      ? "border-border"
                      : "border-amber-300"
                )}
              >
                {/* Compact Question Card Header */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-zinc-50/70 px-3.5 py-2.5">
                  <button
                    type="button"
                    onClick={() => toggleCollapse(q.id)}
                    aria-expanded={!isCollapsed}
                    className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                  >
                    {isCollapsed ? (
                      <ChevronRight
                        className="size-4 shrink-0 text-zinc-400"
                        aria-hidden="true"
                      />
                    ) : (
                      <ChevronDown
                        className="size-4 shrink-0 text-zinc-500"
                        aria-hidden="true"
                      />
                    )}
                    <span className="inline-flex h-6 items-center rounded-md bg-amber-100 px-2 font-mono text-[11px] font-semibold text-amber-800">
                      Q{qIndex + 1}
                    </span>
                    <span
                      className={cn(
                        "truncate text-[13px] font-medium",
                        q.question.trim()
                          ? "text-foreground"
                          : "italic text-zinc-400"
                      )}
                    >
                      {q.question.trim() ||
                        "Untitled question — enter prompt below"}
                    </span>
                  </button>

                  <div className="flex items-center gap-1.5">
                    {isQuestionComplete ? (
                      <span className="hidden items-center gap-1 rounded bg-emerald-50 px-2 py-0.5 text-[10.5px] font-semibold text-emerald-700 sm:inline-flex">
                        <CheckCircle2 className="size-3" aria-hidden="true" />
                        Ready
                      </span>
                    ) : (
                      <span className="hidden items-center gap-1 rounded bg-amber-50 px-2 py-0.5 text-[10.5px] font-semibold text-amber-800 sm:inline-flex">
                        Incomplete
                      </span>
                    )}

                    <select
                      aria-label={`Question ${qIndex + 1} type`}
                      disabled={disabled}
                      value={q.type}
                      onChange={(e) =>
                        handleTypeChange(qIndex, e.target.value as QuizQuestionType)
                      }
                      className="h-7 rounded-md border border-input bg-white px-2 text-[11.5px] text-foreground focus:border-primary focus:outline-none"
                    >
                      <option value="multiple-choice">Multiple choice</option>
                      <option value="true-false">True / False</option>
                    </select>

                    {!disabled ? (
                      <>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          disabled={qIndex === 0}
                          onClick={() => moveQuestion(qIndex, -1)}
                          aria-label={`Move question ${qIndex + 1} up`}
                          title="Move question up"
                        >
                          <ArrowUp className="size-3.5" aria-hidden="true" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          disabled={qIndex === questions.length - 1}
                          onClick={() => moveQuestion(qIndex, 1)}
                          aria-label={`Move question ${qIndex + 1} down`}
                          title="Move question down"
                        >
                          <ArrowDown className="size-3.5" aria-hidden="true" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => duplicateQuestion(qIndex)}
                          aria-label={`Duplicate question ${qIndex + 1}`}
                          title="Duplicate question"
                        >
                          <Copy className="size-3.5" aria-hidden="true" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => removeQuestion(qIndex)}
                          aria-label={`Delete question ${qIndex + 1}`}
                          title="Delete question"
                          className="text-muted-foreground hover:text-red-600"
                        >
                          <Trash2 className="size-3.5" aria-hidden="true" />
                        </Button>
                      </>
                    ) : null}
                  </div>
                </div>

                {/* Question Card Body */}
                {!isCollapsed ? (
                  <div className="space-y-4 p-4">
                    {qError ? (
                      <div
                        role="alert"
                        className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-700"
                      >
                        <AlertCircle
                          className="size-3.5 shrink-0 text-red-600"
                          aria-hidden="true"
                        />
                        <span>{qError}</span>
                      </div>
                    ) : null}

                    {/* Question Prompt */}
                    <div className="space-y-1.5">
                      <label
                        htmlFor={`q-prompt-${q.id}`}
                        className="block text-[12.5px] font-medium text-foreground"
                      >
                        Question {qIndex + 1} prompt{" "}
                        <span className="text-primary">*</span>
                      </label>
                      <Input
                        id={`q-prompt-${q.id}`}
                        disabled={disabled}
                        value={q.question}
                        maxLength={500}
                        onChange={(e) =>
                          updateQuestion(qIndex, { ...q, question: e.target.value })
                        }
                        placeholder="e.g. Which component in an AI agent loop decides when to invoke an external tool?"
                      />
                    </div>

                    {/* Answer Options */}
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-[12.5px] font-medium text-foreground">
                          Answer choices <span className="text-primary">*</span>{" "}
                          <span className="font-normal text-muted-foreground">
                            (click the radio circle on the left to mark the correct answer)
                          </span>
                        </span>
                        <span className="text-[11px] text-zinc-400">
                          {q.options.length}{" "}
                          {q.options.length === 1 ? "option" : "options"}
                        </span>
                      </div>

                      <div
                        className="space-y-2"
                        role="radiogroup"
                        aria-label={`Correct answer for Question ${qIndex + 1}`}
                      >
                        {q.options.map((opt, optIdx) => {
                          const isCorrect = opt.id === q.correctOptionId;
                          const optionLetter = String.fromCharCode(65 + optIdx);

                          return (
                            <div
                              key={opt.id}
                              className={cn(
                                "flex items-center gap-2 rounded-lg border px-2.5 py-2 transition-colors",
                                isCorrect
                                  ? "border-emerald-300 bg-emerald-50/60"
                                  : "border-border bg-zinc-50/40"
                              )}
                            >
                              <button
                                type="button"
                                role="radio"
                                disabled={disabled}
                                aria-checked={isCorrect}
                                aria-label={`Mark Option ${optionLetter} as correct answer`}
                                onClick={() =>
                                  updateQuestion(qIndex, {
                                    ...q,
                                    correctOptionId: opt.id,
                                  })
                                }
                                className={cn(
                                  "flex size-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold transition-colors",
                                  isCorrect
                                    ? "border-emerald-600 bg-emerald-600 text-white"
                                    : "border-zinc-300 bg-white text-muted-foreground hover:border-emerald-500"
                                )}
                                title={
                                  isCorrect
                                    ? "Correct answer"
                                    : "Click to mark as correct answer"
                                }
                              >
                                {isCorrect ? (
                                  <Check className="size-3.5" aria-hidden="true" />
                                ) : (
                                  optionLetter
                                )}
                              </button>

                              {q.type === "true-false" ? (
                                <span className="flex-1 px-2 text-[13px] font-medium text-foreground">
                                  {opt.text}
                                </span>
                              ) : (
                                <Input
                                  disabled={disabled}
                                  value={opt.text}
                                  maxLength={300}
                                  onChange={(e) => {
                                    const nextOpts = q.options.map((item, idx) =>
                                      idx === optIdx
                                        ? { ...item, text: e.target.value }
                                        : item
                                    );
                                    updateQuestion(qIndex, {
                                      ...q,
                                      options: nextOpts,
                                    });
                                  }}
                                  placeholder={`Option ${optionLetter}`}
                                  aria-label={`Question ${qIndex + 1} Option ${optionLetter}`}
                                  className="h-8 bg-white"
                                />
                              )}

                              {isCorrect ? (
                                <span className="shrink-0 rounded bg-emerald-100 px-2 py-0.5 text-[10.5px] font-semibold text-emerald-800">
                                  Correct
                                </span>
                              ) : !disabled ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateQuestion(qIndex, {
                                      ...q,
                                      correctOptionId: opt.id,
                                    })
                                  }
                                  className="hidden shrink-0 rounded px-2 py-0.5 text-[10.5px] font-medium text-muted-foreground hover:bg-zinc-200/70 hover:text-foreground sm:inline-block"
                                >
                                  Set correct
                                </button>
                              ) : null}

                              {!disabled &&
                              q.type === "multiple-choice" &&
                              q.options.length > 2 ? (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-sm"
                                  onClick={() => {
                                    const nextOpts = q.options.filter(
                                      (_, idx) => idx !== optIdx
                                    );
                                    const nextCorrect =
                                      q.correctOptionId === opt.id
                                        ? (nextOpts[0]?.id ?? "")
                                        : q.correctOptionId;
                                    updateQuestion(qIndex, {
                                      ...q,
                                      options: nextOpts,
                                      correctOptionId: nextCorrect,
                                    });
                                  }}
                                  aria-label={`Remove Option ${optionLetter}`}
                                  className="text-muted-foreground hover:text-red-600"
                                >
                                  <Trash2 className="size-3.5" aria-hidden="true" />
                                </Button>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>

                      {!disabled &&
                      q.type === "multiple-choice" &&
                      q.options.length < 6 ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const nextOpts = [
                              ...q.options,
                              { id: makeId("opt"), text: "" },
                            ];
                            updateQuestion(qIndex, {
                              ...q,
                              options: nextOpts,
                            });
                          }}
                          className="gap-1.5"
                        >
                          <Plus className="size-3.5" aria-hidden="true" />
                          Add answer option
                        </Button>
                      ) : null}
                    </div>

                    {/* Optional Explanation */}
                    <div className="space-y-1">
                      <label
                        htmlFor={`q-explanation-${q.id}`}
                        className="block text-[12px] font-medium text-foreground"
                      >
                        Answer explanation{" "}
                        <span className="font-normal text-muted-foreground">
                          (optional)
                        </span>
                      </label>
                      <Input
                        id={`q-explanation-${q.id}`}
                        disabled={disabled}
                        value={q.explanation ?? ""}
                        maxLength={600}
                        onChange={(e) =>
                          updateQuestion(qIndex, {
                            ...q,
                            explanation: e.target.value,
                          })
                        }
                        placeholder="Explain why the correct answer is right (shown after learners check their answer)"
                        className="h-8 text-[12.5px]"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-[11.5px] text-muted-foreground">
                    <span>
                      {q.options.length} choices · Correct:{" "}
                      <strong className="font-semibold text-emerald-700">
                        {correctOption?.text.trim() || "Not set"}
                      </strong>
                    </span>
                    <button
                      type="button"
                      onClick={() => toggleCollapse(q.id)}
                      className="font-medium text-primary hover:underline"
                    >
                      Edit question
                    </button>
                  </div>
                )}
              </div>
            );
          })}

          {/* Bottom Add Question Bar */}
          {!disabled ? (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-dashed border-border bg-muted/30 px-4 py-3">
              <span className="text-[12px] text-muted-foreground">
                Add another question ({questions.length}/50 questions)
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={questions.length >= 50}
                  onClick={() => addQuestion("multiple-choice")}
                >
                  <Plus className="size-3.5" aria-hidden="true" />
                  Multiple choice
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={questions.length >= 50}
                  onClick={() => addQuestion("true-false")}
                >
                  <Plus className="size-3.5" aria-hidden="true" />
                  True / False
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
