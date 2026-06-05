'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowDown, ArrowUp, Plus, Save, Trash2, Check,
  ExternalLink, MessageSquareText, AlignLeft, ChevronsUpDown, ToggleLeft,
  HelpCircle, Layers, Sparkles, X,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useI18n } from '@/lib/i18n/context';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { BookingQuestion, BookingQuestionInputType, Business, Service } from '@/lib/types';

const MAX_QUESTIONS_PER_SCOPE = 3;

const TYPE_OPTIONS: BookingQuestionInputType[] = ['text', 'select', 'yes-no'];

type DraftBookingQuestion = BookingQuestion & {
  local_id: string;
};

function createDraftQuestion(businessId: string, serviceId: string | null, sortOrder: number): DraftBookingQuestion {
  const now = new Date().toISOString();
  const id = `new-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  return {
    id,
    local_id: id,
    business_id: businessId,
    service_id: serviceId,
    question_text: '',
    input_type: 'text',
    options: null,
    is_required: false,
    sort_order: sortOrder,
    created_at: now,
    updated_at: now,
  };
}

function typeLabel(t: BookingQuestionInputType, zh: boolean) {
  if (t === 'text') return zh ? '文字輸入' : 'Free text';
  if (t === 'select') return zh ? '下拉選項' : 'Multiple choice';
  return zh ? '是 / 否' : 'Yes / No';
}

function typeIcon(t: BookingQuestionInputType, size = 13) {
  if (t === 'text') return <AlignLeft size={size} />;
  if (t === 'select') return <ChevronsUpDown size={size} />;
  return <ToggleLeft size={size} />;
}

function typeHint(t: BookingQuestionInputType, zh: boolean) {
  if (t === 'text') return zh ? '客人可填寫任何文字回應' : 'Customers type a short answer';
  if (t === 'select') return zh ? '客人從你提供的選項中選一個' : 'Customers pick one of your options';
  return zh ? '只有「是」或「否」兩個選項' : 'A simple yes-or-no answer';
}

export default function BookingQuestionsSettingsPage() {
  const { t, locale } = useI18n();
  const zh = locale === 'zh-HK';
  const [business, setBusiness] = useState<Business | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [questions, setQuestions] = useState<DraftBookingQuestion[]>([]);
  const [persistedIds, setPersistedIds] = useState<string[]>([]);
  const [selectedScope, setSelectedScope] = useState<string>('business-wide');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setErrorMessage('');

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      setLoading(false);
      return;
    }

    const { data: biz } = await supabase
      .from('businesses')
      .select('*')
      .eq('owner_id', user.id)
      .single();

    if (!biz) {
      setLoading(false);
      return;
    }

    const [{ data: svc }, { data: questionRows }] = await Promise.all([
      supabase.from('services').select('*').eq('business_id', biz.id).eq('active', true).order('sort_order'),
      supabase.from('booking_questions').select('*').eq('business_id', biz.id).order('sort_order'),
    ]);

    setBusiness(biz);
    setServices(svc || []);
    setQuestions(
      (questionRows || []).map((question) => ({
        ...question,
        local_id: question.id,
        options: Array.isArray(question.options) ? question.options : null,
      }))
    );
    setPersistedIds((questionRows || []).map((question) => question.id));
    setLoading(false);
  }, []);

  useEffect(() => {
    const run = async () => {
      await loadData();
    };
    void run();
  }, [loadData]);

  const scopedQuestions = useMemo(
    () => questions
      .filter((q) => (selectedScope === 'business-wide' ? q.service_id === null : q.service_id === selectedScope))
      .sort((a, b) => a.sort_order - b.sort_order),
    [questions, selectedScope]
  );

  // Count questions per scope, for the scope chip pills.
  const counts = useMemo(() => {
    const map = new Map<string, number>();
    map.set('business-wide', 0);
    for (const s of services) map.set(s.id, 0);
    for (const q of questions) {
      const key = q.service_id ?? 'business-wide';
      map.set(key, (map.get(key) || 0) + 1);
    }
    return map;
  }, [questions, services]);

  const totalQuestions = questions.length;
  const requiredCount = questions.filter((q) => q.is_required).length;
  const servicesWithQuestions = useMemo(() => {
    const set = new Set<string>();
    for (const q of questions) {
      set.add(q.service_id ?? 'business-wide');
    }
    return set.size;
  }, [questions]);

  const normalizeScopeSortOrder = (scopeId: string) => {
    setQuestions((current) => {
      const filtered = current
        .filter((q) => (scopeId === 'business-wide' ? q.service_id === null : q.service_id === scopeId))
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((q, i) => ({ ...q, sort_order: i }));
      return current.map((q) => filtered.find((c) => c.local_id === q.local_id) || q);
    });
  };

  const updateQuestion = (
    localId: string,
    patch: Partial<Pick<DraftBookingQuestion, 'question_text' | 'input_type' | 'options' | 'is_required'>>
  ) => {
    setQuestions((current) =>
      current.map((q) => {
        if (q.local_id !== localId) return q;
        const nextInputType = patch.input_type ?? q.input_type;
        return {
          ...q,
          ...patch,
          options: nextInputType === 'select'
            ? patch.options ?? q.options ?? ['']
            : null,
        };
      })
    );
  };

  const addQuestion = () => {
    if (!business || scopedQuestions.length >= MAX_QUESTIONS_PER_SCOPE) return;
    const serviceId = selectedScope === 'business-wide' ? null : selectedScope;
    setQuestions((current) => [
      ...current,
      createDraftQuestion(business.id, serviceId, scopedQuestions.length),
    ]);
    setSaved(false);
  };

  const removeQuestion = (localId: string) => {
    const scopeId = selectedScope;
    setQuestions((current) => current.filter((q) => q.local_id !== localId));
    setSaved(false);
    window.setTimeout(() => normalizeScopeSortOrder(scopeId), 0);
  };

  const moveQuestion = (localId: string, direction: 'up' | 'down') => {
    const scopeId = selectedScope;
    const scoped = [...scopedQuestions];
    const index = scoped.findIndex((q) => q.local_id === localId);
    const targetIndex = direction === 'up' ? index - 1 : index + 1;

    if (index < 0 || targetIndex < 0 || targetIndex >= scoped.length) return;

    [scoped[index], scoped[targetIndex]] = [scoped[targetIndex], scoped[index]];

    setQuestions((current) =>
      current.map((q) => {
        const reordered = scoped.find((c) => c.local_id === q.local_id);
        if (!reordered) return q;
        return { ...q, sort_order: scoped.findIndex((c) => c.local_id === q.local_id) };
      })
    );

    window.setTimeout(() => normalizeScopeSortOrder(scopeId), 0);
    setSaved(false);
  };

  const handleSave = async () => {
    if (!business) return;
    setSaving(true);
    setSaved(false);
    setErrorMessage('');

    const validationError = questions.find((q) => {
      if (!q.question_text.trim()) return true;
      if (q.input_type === 'select') {
        const opts = (q.options || []).map((o) => o.trim()).filter(Boolean);
        return opts.length === 0;
      }
      return false;
    });

    if (validationError) {
      setSaving(false);
      setErrorMessage(
        zh
          ? '請為每條問題填寫內容；下拉選項至少要有一個選項。'
          : 'Please add text for every question and at least one option for each multiple-choice question.'
      );
      return;
    }

    const supabase = createClient();
    const currentPersistedIds = questions.filter((q) => !q.id.startsWith('new-')).map((q) => q.id);
    const deletedIds = persistedIds.filter((id) => !currentPersistedIds.includes(id));

    if (deletedIds.length > 0) {
      const { error } = await supabase.from('booking_questions').delete().in('id', deletedIds);
      if (error) {
        setSaving(false);
        setErrorMessage(error.message);
        return;
      }
    }

    const payload = questions.map((q) => ({
      business_id: business.id,
      service_id: q.service_id,
      question_text: q.question_text.trim(),
      input_type: q.input_type,
      options: q.input_type === 'select'
        ? (q.options || []).map((o) => o.trim()).filter(Boolean)
        : null,
      is_required: q.is_required,
      sort_order: q.sort_order,
    }));

    const existingRows = questions.filter((q) => !q.id.startsWith('new-'));
    for (const q of existingRows) {
      const row = payload.find((c, i) => questions[i].local_id === q.local_id);
      const { error } = await supabase.from('booking_questions').update(row).eq('id', q.id);
      if (error) {
        setSaving(false);
        setErrorMessage(error.message);
        return;
      }
    }

    const newRows = questions
      .filter((q) => q.id.startsWith('new-'))
      .map((q) => payload.find((c, i) => questions[i].local_id === q.local_id))
      .filter(Boolean);

    if (newRows.length > 0) {
      const { error } = await supabase.from('booking_questions').insert(newRows);
      if (error) {
        setSaving(false);
        setErrorMessage(error.message);
        return;
      }
    }

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2400);
    await loadData();
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-muted">{t('loading')}</div>;
  }

  const scopeLabel = selectedScope === 'business-wide'
    ? (zh ? '所有服務共用' : 'Every service')
    : (() => {
        const svc = services.find((s) => s.id === selectedScope);
        return svc ? (zh && svc.name_zh ? svc.name_zh : svc.name) : '—';
      })();

  return (
    <div className="space-y-7 pb-24">
      {/* ── HEADER ─────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between animate-fade-up">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-[#9CA3AF] mb-1">
            {zh ? '設定 · 預約問題' : 'Settings · Booking questions'}
          </p>
          <h1 className="font-display text-[28px] md:text-[34px] leading-[1.05] font-light text-[#111111]">
            {zh ? '預約問題' : 'Ask the right things'}<span className="text-[#0F766E]">.</span>
          </h1>
          <p className="text-sm text-[#6B7280] mt-1.5 max-w-xl">
            {zh
              ? '在預約流程中加入最多 3 條問題，幫你提前準備並減少來回。'
              : 'Slip up to 3 short prompts into the booking flow — prep ahead, skip the back-and-forth.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {business?.slug && (
            <a
              href={`/book/${business.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border border-[#E5E7EB] text-[#6B7280] hover:border-[#0F766E] hover:text-[#0F766E] transition-colors"
            >
              <ExternalLink size={13} />
              {zh ? '預覽' : 'Preview'}
            </a>
          )}
        </div>
      </div>

      {/* ── KPI STRIP ──────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3 animate-fade-up" style={{ animationDelay: '60ms' }}>
        <SummaryCard
          eyebrow={zh ? '已設定' : 'Total questions'}
          value={totalQuestions}
          color="#0F766E"
          hint={zh ? '所有範圍合計' : 'Across all scopes'}
        />
        <SummaryCard
          eyebrow={zh ? '必填' : 'Required'}
          value={requiredCount}
          color="#D97706"
          hint={zh ? '客人必須回答' : 'Customers must answer'}
        />
        <SummaryCard
          eyebrow={zh ? '已套用範圍' : 'Active scopes'}
          value={servicesWithQuestions}
          color="#111111"
          hint={zh ? '有設定問題的服務' : 'Services with questions'}
        />
      </div>

      {/* ── SCOPE CHIPS ────────────────────────────────────────── */}
      <div className="space-y-3 animate-fade-up" style={{ animationDelay: '120ms' }}>
        <div className="flex items-baseline justify-between">
          <p className="text-[10px] uppercase tracking-[0.2em] text-[#9CA3AF] font-medium inline-flex items-center gap-1.5">
            <Layers size={11} />
            {zh ? '套用範圍' : 'Applies to'}
          </p>
          <p className="text-[10px] uppercase tracking-[0.18em] text-[#9CA3AF]">
            {zh ? `共 ${services.length + 1} 個範圍` : `${services.length + 1} scopes available`}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <ScopeChip
            active={selectedScope === 'business-wide'}
            onClick={() => setSelectedScope('business-wide')}
            label={zh ? '所有服務共用' : 'Every service'}
            count={counts.get('business-wide') || 0}
            isWide
          />
          {services.map((svc) => (
            <ScopeChip
              key={svc.id}
              active={selectedScope === svc.id}
              onClick={() => setSelectedScope(svc.id)}
              label={zh && svc.name_zh ? svc.name_zh : svc.name}
              count={counts.get(svc.id) || 0}
            />
          ))}
        </div>
      </div>

      {/* ── EDITOR + PREVIEW ──────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6 animate-fade-up" style={{ animationDelay: '180ms' }}>
        {/* EDITOR */}
        <div className="lg:col-span-8 space-y-3">
          <div className="flex items-end justify-between mb-1">
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-[#9CA3AF] font-medium">
                {zh ? '編輯' : 'Editing'}
              </p>
              <h2 className="font-display text-[20px] font-light text-[#111111] leading-tight mt-0.5">
                {scopeLabel}
              </h2>
              <p className="text-xs text-[#6B7280] mt-1">
                {zh
                  ? `已設定 ${scopedQuestions.length}/${MAX_QUESTIONS_PER_SCOPE} 條`
                  : `${scopedQuestions.length} of ${MAX_QUESTIONS_PER_SCOPE} configured`}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={addQuestion}
              disabled={!business || scopedQuestions.length >= MAX_QUESTIONS_PER_SCOPE}
            >
              <Plus size={14} />
              {zh ? '新增問題' : 'Add question'}
            </Button>
          </div>

          {errorMessage && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-start gap-2">
              <HelpCircle size={15} className="mt-0.5 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {scopedQuestions.length === 0 ? (
            <EmptyState zh={zh} onAdd={addQuestion} canAdd={!!business} />
          ) : (
            <div className="space-y-2.5">
              {scopedQuestions.map((q, idx) => (
                <QuestionCard
                  key={q.local_id}
                  question={q}
                  index={idx}
                  total={scopedQuestions.length}
                  zh={zh}
                  onUpdate={(patch) => updateQuestion(q.local_id, patch)}
                  onMoveUp={idx > 0 ? () => moveQuestion(q.local_id, 'up') : undefined}
                  onMoveDown={idx < scopedQuestions.length - 1 ? () => moveQuestion(q.local_id, 'down') : undefined}
                  onRemove={() => removeQuestion(q.local_id)}
                />
              ))}
            </div>
          )}

          {/* Suggestions strip */}
          {scopedQuestions.length < MAX_QUESTIONS_PER_SCOPE && (
            <SuggestionStrip
              zh={zh}
              onPick={(text, type) => {
                if (!business || scopedQuestions.length >= MAX_QUESTIONS_PER_SCOPE) return;
                const serviceId = selectedScope === 'business-wide' ? null : selectedScope;
                const draft = createDraftQuestion(business.id, serviceId, scopedQuestions.length);
                draft.question_text = text;
                draft.input_type = type;
                if (type === 'select') draft.options = [''];
                setQuestions((cur) => [...cur, draft]);
                setSaved(false);
              }}
              disabled={!business}
            />
          )}
        </div>

        {/* LIVE PREVIEW */}
        <div className="lg:col-span-4">
          <div className="lg:sticky lg:top-6">
            <p className="text-[10px] uppercase tracking-[0.2em] text-[#9CA3AF] font-medium mb-2 inline-flex items-center gap-1.5">
              <Sparkles size={11} />
              {zh ? '預覽' : 'Customer preview'}
            </p>
            <PreviewPane questions={scopedQuestions} zh={zh} />
          </div>
        </div>
      </div>

      {/* ── STICKY SAVE BAR ───────────────────────────────────── */}
      <div className="fixed bottom-0 left-0 lg:left-56 right-0 bg-white/95 backdrop-blur border-t border-[#E5E7EB] z-40">
        <div className="px-5 lg:px-8 py-3 flex items-center justify-between gap-3">
          <p className="text-xs text-[#9CA3AF] hidden sm:block">
            {saved
              ? (zh ? '已儲存 · 即時更新' : 'Saved · live on your booking page')
              : (zh ? '完成編輯後別忘記儲存。' : 'Remember to save your changes.')}
          </p>
          <div className="flex items-center gap-2 ml-auto">
            <Button onClick={handleSave} loading={saving}>
              {saved ? <Check size={16} /> : <Save size={16} />}
              {saved ? (zh ? '已儲存' : 'Saved') : t('save')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── SUMMARY CARD ─────────────────────────────────────────────────────────────

function SummaryCard({
  eyebrow,
  value,
  color,
  hint,
}: {
  eyebrow: string;
  value: number;
  color: string;
  hint?: string;
}) {
  const dim = value === 0;
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <p className="text-[10px] uppercase tracking-[0.2em] text-[#9CA3AF] font-medium">{eyebrow}</p>
        <span className="w-1.5 h-1.5 rounded-full mt-1.5" style={{ background: dim ? '#E5E7EB' : color }} />
      </div>
      <div className="font-display text-[36px] leading-none font-light tabular-nums mt-2" style={{ color: dim ? '#D1D5DB' : '#111111' }}>
        {value}
      </div>
      {hint && <p className="text-[11px] text-[#9CA3AF] mt-2 tracking-wide">{hint}</p>}
    </Card>
  );
}

// ── SCOPE CHIP ───────────────────────────────────────────────────────────────

function ScopeChip({
  active,
  onClick,
  label,
  count,
  isWide,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  isWide?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer border ${
        active
          ? 'bg-[#111111] text-white border-[#111111]'
          : 'bg-white text-[#6B7280] border-[#E5E7EB] hover:border-[#9CA3AF] hover:text-[#111111]'
      }`}
    >
      {isWide && (
        <Layers size={11} className={active ? 'text-white/70' : 'text-[#9CA3AF]'} />
      )}
      <span className="truncate max-w-[180px]">{label}</span>
      <span
        className={`tabular-nums text-[10px] px-1.5 py-0.5 rounded-full ${
          active
            ? 'bg-white/15 text-white/85'
            : count > 0
              ? 'bg-[#0F766E]/10 text-[#0F766E]'
              : 'bg-[#F3F4F6] text-[#9CA3AF]'
        }`}
      >
        {count}
      </span>
    </button>
  );
}

// ── QUESTION CARD ────────────────────────────────────────────────────────────

function QuestionCard({
  question,
  index,
  total,
  zh,
  onUpdate,
  onMoveUp,
  onMoveDown,
  onRemove,
}: {
  question: DraftBookingQuestion;
  index: number;
  total: number;
  zh: boolean;
  onUpdate: (patch: Partial<Pick<DraftBookingQuestion, 'question_text' | 'input_type' | 'options' | 'is_required'>>) => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onRemove: () => void;
}) {
  const accent = question.is_required ? '#D97706' : '#0F766E';

  return (
    <div className="relative bg-white rounded-2xl border border-[#E5E7EB] hover:border-[#0F766E]/40 transition-all overflow-hidden">
      <div className="absolute left-0 top-0 bottom-0 w-1" style={{ background: accent }} />

      <div className="pl-5 pr-4 py-4 space-y-4">
        {/* row header */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="font-display text-[28px] leading-none font-light text-[#111111] tabular-nums">
              {(index + 1).toString().padStart(2, '0')}
            </span>
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-[#9CA3AF] font-medium">
                {zh ? `問題` : `Question`}
              </p>
              <p className="text-[10px] uppercase tracking-[0.15em] text-[#9CA3AF]">
                {index + 1} / {total}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-0.5">
            <ReorderButton onClick={onMoveUp} disabled={!onMoveUp} dir="up" />
            <ReorderButton onClick={onMoveDown} disabled={!onMoveDown} dir="down" />
            <button
              type="button"
              onClick={onRemove}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-[#9CA3AF] hover:text-red-500 hover:bg-red-50 transition-colors cursor-pointer ml-1"
              aria-label={zh ? '刪除' : 'Remove'}
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>

        {/* question text */}
        <Input
          id={`question-text-${question.local_id}`}
          label={zh ? '問題內容' : 'Question text'}
          value={question.question_text}
          onChange={(e) => onUpdate({ question_text: e.target.value })}
          placeholder={zh ? '例：想坐窗邊位置嗎？' : 'e.g. Any preferences we should know?'}
        />

        {/* type segmented */}
        <div className="space-y-2">
          <p className="text-[10px] uppercase tracking-[0.2em] text-[#9CA3AF] font-medium">
            {zh ? '回答方式' : 'Answer type'}
          </p>
          <div className="grid grid-cols-3 gap-2">
            {TYPE_OPTIONS.map((tp) => {
              const active = question.input_type === tp;
              return (
                <button
                  key={tp}
                  type="button"
                  onClick={() => onUpdate({ input_type: tp })}
                  className={`relative rounded-xl border px-3 py-3 text-left transition-all cursor-pointer ${
                    active
                      ? 'border-[#0F766E] bg-[#0F766E]/[0.04] ring-1 ring-[#0F766E]/30'
                      : 'border-[#E5E7EB] bg-white hover:border-[#9CA3AF]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                        active ? 'bg-[#0F766E] text-white' : 'bg-[#F3F4F6] text-[#6B7280]'
                      }`}
                    >
                      {typeIcon(tp)}
                    </span>
                    <span className={`text-xs font-medium ${active ? 'text-[#111111]' : 'text-[#3D3D3D]'}`}>
                      {typeLabel(tp, zh)}
                    </span>
                  </div>
                  <p className="text-[10px] text-[#9CA3AF] mt-1.5 leading-snug">
                    {typeHint(tp, zh)}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* options for select */}
        {question.input_type === 'select' && (
          <OptionsEditor
            options={question.options || ['']}
            onChange={(next) => onUpdate({ options: next })}
            zh={zh}
          />
        )}

        {/* required toggle */}
        <div className="flex items-center justify-between pt-3 border-t border-dashed border-[#E5E7EB]">
          <div className="flex items-start gap-3 min-w-0">
            <span className="w-7 h-7 rounded-full bg-[#FEF3C7] flex items-center justify-center text-[#D97706] shrink-0">
              <span className="text-sm font-display leading-none">*</span>
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-[#111111]">
                {zh ? '必填' : 'Required'}
              </p>
              <p className="text-[11px] text-[#9CA3AF] mt-0.5 leading-snug">
                {zh ? '客人必須回答此問題才能完成預約' : 'Customer must answer to complete the booking'}
              </p>
            </div>
          </div>
          <Toggle
            checked={question.is_required}
            onChange={() => onUpdate({ is_required: !question.is_required })}
          />
        </div>
      </div>
    </div>
  );
}

// ── OPTIONS EDITOR ───────────────────────────────────────────────────────────

function OptionsEditor({
  options,
  onChange,
  zh,
}: {
  options: string[];
  onChange: (next: string[]) => void;
  zh: boolean;
}) {
  const update = (idx: number, value: string) => {
    const next = [...options];
    next[idx] = value;
    onChange(next);
  };
  const remove = (idx: number) => {
    if (options.length <= 1) return;
    onChange(options.filter((_, i) => i !== idx));
  };
  const add = () => {
    if (options.length >= 8) return;
    onChange([...options, '']);
  };

  return (
    <div className="rounded-xl bg-[#FAFAF8] border border-[#E5E7EB] p-3.5 space-y-2">
      <div className="flex items-baseline justify-between">
        <p className="text-[10px] uppercase tracking-[0.2em] text-[#9CA3AF] font-medium">
          {zh ? '選項' : 'Options'}
        </p>
        <p className="text-[10px] text-[#9CA3AF]">
          {options.length} / 8
        </p>
      </div>
      <div className="space-y-1.5">
        {options.map((opt, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="text-[10px] tabular-nums text-[#9CA3AF] w-5 text-right shrink-0">
              {String.fromCharCode(65 + i)}
            </span>
            <input
              type="text"
              value={opt}
              onChange={(e) => update(i, e.target.value)}
              placeholder={zh ? `選項 ${i + 1}` : `Option ${i + 1}`}
              className="flex-1 h-9 px-3 rounded-lg border border-[#E5E7EB] bg-white text-sm text-[#111111] placeholder:text-[#D1D5DB] transition-colors focus:outline-none focus:ring-2 focus:ring-[#0F766E]/20 focus:border-[#0F766E]"
            />
            <button
              type="button"
              onClick={() => remove(i)}
              disabled={options.length <= 1}
              className="w-7 h-7 rounded-md flex items-center justify-center text-[#9CA3AF] hover:text-red-500 hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer shrink-0"
              aria-label={zh ? '移除' : 'Remove'}
            >
              <X size={12} />
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={add}
        disabled={options.length >= 8}
        className="text-[11px] uppercase tracking-[0.18em] text-[#0F766E] hover:underline disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1 cursor-pointer"
      >
        <Plus size={11} /> {zh ? '加入選項' : 'Add option'}
      </button>
    </div>
  );
}

// ── EMPTY STATE ──────────────────────────────────────────────────────────────

function EmptyState({ zh, onAdd, canAdd }: { zh: boolean; onAdd: () => void; canAdd: boolean }) {
  return (
    <Card className="relative overflow-hidden p-10 text-center">
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.4] pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(#E5E7EB 1px, transparent 1px)',
          backgroundSize: '14px 14px',
          maskImage: 'radial-gradient(circle at center, black, transparent 75%)',
          WebkitMaskImage: 'radial-gradient(circle at center, black, transparent 75%)',
        }}
      />
      <div className="relative">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[#0F766E]/10 mb-4">
          <MessageSquareText size={24} className="text-[#0F766E]" />
        </div>
        <p className="font-display text-2xl font-light text-[#111111]">
          {zh ? '尚未設定問題' : 'No questions yet.'}
        </p>
        <p className="text-sm text-[#6B7280] mt-1.5 max-w-md mx-auto">
          {zh
            ? '加入 1 至 3 條簡短問題，幫你提早準備並節省 WhatsApp 時間。'
            : 'Add 1 – 3 short prompts to capture preferences upfront and skip the WhatsApp ping-pong.'}
        </p>
        <div className="mt-5">
          <Button onClick={onAdd} disabled={!canAdd}>
            <Plus size={14} /> {zh ? '新增第一條問題' : 'Add your first question'}
          </Button>
        </div>
      </div>
    </Card>
  );
}

// ── SUGGESTION STRIP ─────────────────────────────────────────────────────────

function SuggestionStrip({
  zh,
  onPick,
  disabled,
}: {
  zh: boolean;
  onPick: (text: string, type: BookingQuestionInputType) => void;
  disabled?: boolean;
}) {
  const suggestions: { text: string; type: BookingQuestionInputType }[] = zh
    ? [
        { text: '是否首次到訪？', type: 'yes-no' },
        { text: '有沒有想參考的款式或圖片？', type: 'text' },
        { text: '想坐窗邊還是其他位置？', type: 'select' },
        { text: '有沒有過敏或要避開的事項？', type: 'text' },
      ]
    : [
        { text: 'Is this your first visit?', type: 'yes-no' },
        { text: 'Any reference style or photo?', type: 'text' },
        { text: 'Window seat or other?', type: 'select' },
        { text: 'Any allergies or things to avoid?', type: 'text' },
      ];

  return (
    <div className="rounded-xl border border-dashed border-[#D1D5DB] bg-white px-4 py-3">
      <p className="text-[10px] uppercase tracking-[0.2em] text-[#9CA3AF] font-medium mb-2 inline-flex items-center gap-1.5">
        <Sparkles size={11} className="text-[#0F766E]" />
        {zh ? '常見問題建議' : 'Quick-add suggestions'}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {suggestions.map((s, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onPick(s.text, s.type)}
            disabled={disabled}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[11px] text-[#3D3D3D] bg-[#FAFAF8] border border-[#E5E7EB] hover:border-[#0F766E] hover:bg-[#0F766E]/5 hover:text-[#0F766E] disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            <span className="text-[#9CA3AF]">{typeIcon(s.type, 11)}</span>
            <span className="truncate max-w-[260px]">{s.text}</span>
            <Plus size={10} className="text-[#9CA3AF]" />
          </button>
        ))}
      </div>
    </div>
  );
}

// ── PREVIEW PANE ─────────────────────────────────────────────────────────────

function PreviewPane({
  questions,
  zh,
}: {
  questions: DraftBookingQuestion[];
  zh: boolean;
}) {
  return (
    <div className="rounded-2xl border border-[#E5E7EB] bg-gradient-to-br from-[#FAFAF8] to-white p-5 shadow-sm">
      <div className="flex items-center gap-2 pb-3 border-b border-dashed border-[#E5E7EB] mb-4">
        <div className="w-2 h-2 rounded-full bg-[#EF4444]" />
        <div className="w-2 h-2 rounded-full bg-[#D97706]" />
        <div className="w-2 h-2 rounded-full bg-[#10B981]" />
        <span className="text-[10px] uppercase tracking-[0.2em] text-[#9CA3AF] ml-auto">
          {zh ? '預約頁面' : 'Booking flow'}
        </span>
      </div>

      {questions.length === 0 ? (
        <p className="text-xs text-[#9CA3AF] italic text-center py-6">
          {zh ? '預覽會在這裡顯示...' : 'Your questions will preview here.'}
        </p>
      ) : (
        <div className="space-y-4">
          {questions.map((q, i) => (
            <div key={q.local_id}>
              <div className="flex items-baseline gap-2 mb-1.5">
                <span className="font-display text-[14px] font-light text-[#9CA3AF] tabular-nums">
                  {(i + 1).toString().padStart(2, '0')}
                </span>
                <p className="text-[13px] font-medium text-[#111111] flex-1">
                  {q.question_text || (zh ? '（問題內容）' : '(Question text)')}
                  {q.is_required && <span className="text-[#D97706] ml-1">*</span>}
                </p>
              </div>
              <PreviewInput question={q} zh={zh} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PreviewInput({ question: q, zh }: { question: DraftBookingQuestion; zh: boolean }) {
  if (q.input_type === 'text') {
    return (
      <div className="h-9 rounded-lg border border-[#E5E7EB] bg-white px-3 flex items-center text-[12px] text-[#D1D5DB]">
        {zh ? '客人輸入回應...' : 'Customer types here…'}
      </div>
    );
  }
  if (q.input_type === 'yes-no') {
    return (
      <div className="flex gap-2">
        <span className="flex-1 h-9 rounded-lg border border-[#E5E7EB] bg-white text-[12px] text-[#6B7280] inline-flex items-center justify-center">
          {zh ? '是' : 'Yes'}
        </span>
        <span className="flex-1 h-9 rounded-lg border border-[#E5E7EB] bg-white text-[12px] text-[#6B7280] inline-flex items-center justify-center">
          {zh ? '否' : 'No'}
        </span>
      </div>
    );
  }
  // select
  const opts = (q.options || []).filter((o) => o.trim());
  if (opts.length === 0) {
    return (
      <div className="h-9 rounded-lg border border-dashed border-[#D1D5DB] bg-white px-3 flex items-center text-[11px] text-[#D1D5DB] italic">
        {zh ? '加入選項以預覽' : 'Add options to preview'}
      </div>
    );
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {opts.map((o, i) => (
        <span
          key={i}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] text-[#6B7280] bg-white border border-[#E5E7EB]"
        >
          {o}
        </span>
      ))}
    </div>
  );
}

// ── REORDER BUTTON ───────────────────────────────────────────────────────────

function ReorderButton({
  onClick,
  disabled,
  dir,
}: {
  onClick?: () => void;
  disabled?: boolean;
  dir: 'up' | 'down';
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-7 h-7 rounded-lg flex items-center justify-center text-[#9CA3AF] hover:text-[#111111] hover:bg-[#F3F4F6] disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
      aria-label={dir === 'up' ? 'Move up' : 'Move down'}
    >
      {dir === 'up' ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
    </button>
  );
}

// ── TOGGLE ───────────────────────────────────────────────────────────────────

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none shrink-0 ${
        checked ? 'bg-[#D97706]' : 'bg-[#E5E7EB]'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
          checked ? 'translate-x-[18px]' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}
