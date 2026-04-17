'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Plus, Save, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useI18n } from '@/lib/i18n/context';
import { Card, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import type { BookingQuestion, BookingQuestionInputType, Business, Service } from '@/lib/types';

const MAX_QUESTIONS_PER_SCOPE = 3;

type DraftBookingQuestion = BookingQuestion & {
  local_id: string;
};

function createDraftQuestion(businessId: string, serviceId: string | null, sortOrder: number): DraftBookingQuestion {
  const now = new Date().toISOString();

  return {
    id: `new-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    local_id: `new-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
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
    const {
      data: { user },
    } = await supabase.auth.getUser();

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
      supabase.from('services').select('*').eq('business_id', biz.id).order('sort_order'),
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

  const scopedQuestions = questions
    .filter((question) => (selectedScope === 'business-wide' ? question.service_id === null : question.service_id === selectedScope))
    .sort((a, b) => a.sort_order - b.sort_order);

  const normalizeScopeSortOrder = (scopeId: string) => {
    setQuestions((current) => {
      const filtered = current
        .filter((question) => (scopeId === 'business-wide' ? question.service_id === null : question.service_id === scopeId))
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((question, index) => ({ ...question, sort_order: index }));

      return current.map((question) => {
        const match = filtered.find((candidate) => candidate.local_id === question.local_id);
        return match || question;
      });
    });
  };

  const updateQuestion = (
    localId: string,
    patch: Partial<Pick<DraftBookingQuestion, 'question_text' | 'input_type' | 'options' | 'is_required'>>
  ) => {
    setQuestions((current) =>
      current.map((question) => {
        if (question.local_id !== localId) return question;

        const nextInputType = patch.input_type ?? question.input_type;

        return {
          ...question,
          ...patch,
          options:
            nextInputType === 'select'
              ? patch.options ?? question.options ?? ['']
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
    setQuestions((current) => current.filter((question) => question.local_id !== localId));
    setSaved(false);

    window.setTimeout(() => normalizeScopeSortOrder(scopeId), 0);
  };

  const moveQuestion = (localId: string, direction: 'up' | 'down') => {
    const scopeId = selectedScope;
    const scoped = [...scopedQuestions];
    const index = scoped.findIndex((question) => question.local_id === localId);
    const targetIndex = direction === 'up' ? index - 1 : index + 1;

    if (index < 0 || targetIndex < 0 || targetIndex >= scoped.length) return;

    [scoped[index], scoped[targetIndex]] = [scoped[targetIndex], scoped[index]];

    setQuestions((current) =>
      current.map((question) => {
        const reorderedQuestion = scoped.find((candidate) => candidate.local_id === question.local_id);
        if (!reorderedQuestion) return question;
        return {
          ...question,
          sort_order: scoped.findIndex((candidate) => candidate.local_id === question.local_id),
        };
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

    const validationError = questions.find((question) => {
      if (!question.question_text.trim()) return true;
      if (question.input_type === 'select') {
        const sanitizedOptions = (question.options || []).map((option) => option.trim()).filter(Boolean);
        return sanitizedOptions.length === 0;
      }
      return false;
    });

    if (validationError) {
      setSaving(false);
      setErrorMessage(
        zh
          ? '請為每條問題填寫內容；下拉選項至少要有一個選項。'
          : 'Please add text for every question and at least one option for each select question.'
      );
      return;
    }

    const supabase = createClient();
    const currentPersistedIds = questions.filter((question) => !question.id.startsWith('new-')).map((question) => question.id);
    const deletedIds = persistedIds.filter((id) => !currentPersistedIds.includes(id));

    if (deletedIds.length > 0) {
      const { error } = await supabase.from('booking_questions').delete().in('id', deletedIds);
      if (error) {
        setSaving(false);
        setErrorMessage(error.message);
        return;
      }
    }

    const payload = questions.map((question) => ({
      business_id: business.id,
      service_id: question.service_id,
      question_text: question.question_text.trim(),
      input_type: question.input_type,
      options:
        question.input_type === 'select'
          ? (question.options || []).map((option) => option.trim()).filter(Boolean)
          : null,
      is_required: question.is_required,
      sort_order: question.sort_order,
    }));

    const existingRows = questions.filter((question) => !question.id.startsWith('new-'));
    for (const question of existingRows) {
      const row = payload.find((candidate, index) => questions[index].local_id === question.local_id);
      const { error } = await supabase.from('booking_questions').update(row).eq('id', question.id);
      if (error) {
        setSaving(false);
        setErrorMessage(error.message);
        return;
      }
    }

    const newRows = questions
      .filter((question) => question.id.startsWith('new-'))
      .map((question) => payload.find((candidate, index) => questions[index].local_id === question.local_id))
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
    setTimeout(() => setSaved(false), 3000);
    await loadData();
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-muted">{t('loading')}</div>;
  }

  const scopeOptions = [
    { value: 'business-wide', label: zh ? '所有服務共用' : 'Business-wide' },
    ...services.map((service) => ({
      value: service.id,
      label: zh && service.name_zh ? service.name_zh : service.name,
    })),
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">{zh ? '預約問題' : 'Booking Questions'}</h1>
          <p className="text-sm text-muted mt-1">
            {zh
              ? '每個服務或全店共用最多可設定 3 條問題。'
              : 'Add up to 3 short questions per service, or create a business-wide set for all services.'}
          </p>
        </div>
        <Button onClick={handleSave} loading={saving}>
          <Save size={16} />
          {saved ? t('success') : t('save')}
        </Button>
      </div>

      <Card>
        <div className="grid gap-4 lg:grid-cols-[280px_1fr] lg:items-end">
          <Select
            id="booking-question-scope"
            label={zh ? '套用範圍' : 'Applies To'}
            value={selectedScope}
            onChange={(event) => setSelectedScope(event.target.value)}
            options={scopeOptions}
          />
          <div className="rounded-xl border border-dashed border-[#D1D5DB] bg-[#F9FAFB] px-4 py-3 text-sm text-[#6B7280]">
            {selectedScope === 'business-wide'
              ? (zh ? '這些問題會在所有服務的預約流程中顯示。' : 'These questions will appear for every service in the booking flow.')
              : (zh ? '這些問題只會在所選服務的預約流程中顯示。' : 'These questions will only appear when this service is selected.')}
          </div>
        </div>
      </Card>

      <Card>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
          <div>
            <CardTitle>{zh ? '問題設定' : 'Question Setup'}</CardTitle>
            <p className="text-sm text-muted mt-1">
              {zh
                ? `已設定 ${scopedQuestions.length}/${MAX_QUESTIONS_PER_SCOPE} 條`
                : `${scopedQuestions.length}/${MAX_QUESTIONS_PER_SCOPE} questions configured`}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={addQuestion}
            disabled={!business || scopedQuestions.length >= MAX_QUESTIONS_PER_SCOPE}
          >
            <Plus size={16} />
            {zh ? '新增問題' : 'Add Question'}
          </Button>
        </div>

        {errorMessage && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {errorMessage}
          </div>
        )}

        <div className="space-y-4">
          {scopedQuestions.map((question, index) => (
            <div key={question.local_id} className="rounded-2xl border border-[#E5E7EB] bg-[#FAFAFB] p-4">
              <div className="flex items-start justify-between gap-3 mb-4">
                <div>
                  <p className="text-sm font-semibold text-[#111111]">
                    {zh ? `問題 ${index + 1}` : `Question ${index + 1}`}
                  </p>
                  <p className="text-xs text-[#6B7280] mt-1">
                    {zh ? '保持簡短自然，像預約流程中的補充提問。' : 'Keep it short so it feels natural in the booking flow.'}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => moveQuestion(question.local_id, 'up')}
                    disabled={index === 0}
                    className="rounded-lg border border-[#E5E7EB] bg-white p-2 text-[#6B7280] transition-colors hover:text-[#111111] disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <ChevronUp size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveQuestion(question.local_id, 'down')}
                    disabled={index === scopedQuestions.length - 1}
                    className="rounded-lg border border-[#E5E7EB] bg-white p-2 text-[#6B7280] transition-colors hover:text-[#111111] disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <ChevronDown size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeQuestion(question.local_id)}
                    className="rounded-lg border border-red-100 bg-white p-2 text-red-500 transition-colors hover:bg-red-50"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-[1.4fr_220px]">
                <Input
                  id={`question-text-${question.local_id}`}
                  label={zh ? '問題內容' : 'Question Text'}
                  value={question.question_text}
                  onChange={(event) => updateQuestion(question.local_id, { question_text: event.target.value })}
                  placeholder={zh ? '例如：想坐窗邊位置嗎？' : 'Example: Do you prefer a window seat?'}
                />
                <Select
                  id={`question-type-${question.local_id}`}
                  label={zh ? '回答方式' : 'Input Type'}
                  value={question.input_type}
                  onChange={(event) =>
                    updateQuestion(question.local_id, {
                      input_type: event.target.value as BookingQuestionInputType,
                    })
                  }
                  options={[
                    { value: 'text', label: zh ? '文字輸入' : 'Text' },
                    { value: 'select', label: zh ? '下拉選項' : 'Select' },
                    { value: 'yes-no', label: zh ? '是 / 否' : 'Yes / No' },
                  ]}
                />
              </div>

              {question.input_type === 'select' && (
                <div className="mt-4 space-y-1.5">
                  <label htmlFor={`question-options-${question.local_id}`} className="block text-xs font-medium text-[#3D3D3D]">
                    {zh ? '選項' : 'Options'}
                  </label>
                  <textarea
                    id={`question-options-${question.local_id}`}
                    rows={3}
                    value={(question.options || []).join('\n')}
                    onChange={(event) =>
                      updateQuestion(question.local_id, {
                        options: event.target.value.split('\n'),
                      })
                    }
                    placeholder={zh ? '每行一個選項，例如：\n首次到店\n回訪客人' : 'One option per line, for example:\nFirst visit\nReturning customer'}
                    className="w-full rounded-lg border border-[#E5E7EB] bg-white px-3.5 py-2.5 text-sm text-[#111111] placeholder:text-[#D1D5DB] transition-colors focus:outline-none focus:ring-2 focus:ring-[#0F766E]/20 focus:border-[#0F766E] resize-none"
                  />
                </div>
              )}

              <label className="mt-4 inline-flex items-center gap-2 text-sm text-[#3D3D3D]">
                <input
                  type="checkbox"
                  checked={question.is_required}
                  onChange={(event) => updateQuestion(question.local_id, { is_required: event.target.checked })}
                  className="h-4 w-4 rounded border border-[#D1D5DB] text-[#0F766E] focus:ring-[#0F766E]/20"
                />
                <span>{zh ? '必填' : 'Required'}</span>
              </label>
            </div>
          ))}

          {scopedQuestions.length === 0 && (
            <div className="rounded-2xl border border-dashed border-[#D1D5DB] bg-[#FAFAFB] px-6 py-10 text-center">
              <p className="text-sm font-medium text-[#111111]">
                {zh ? '這個範圍尚未設定問題' : 'No questions set for this scope yet'}
              </p>
              <p className="text-sm text-[#6B7280] mt-2">
                {zh
                  ? '你可以先加入 1 至 3 條簡短問題，例如偏好、注意事項或首次到店資訊。'
                  : 'Add 1 to 3 short prompts for preferences, special notes, or first-visit info.'}
              </p>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
