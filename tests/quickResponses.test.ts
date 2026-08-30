import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { extractQuickResponses, cleanContent } from '../src/utils/helpers';

describe('Quick Responses & Action Parsing Subsystem', () => {
  it('should parse structured XML <quick_response> with <option> attributes', () => {
    const rawContent = `Отличный вопрос! Я могу помочь с этим несколькими способами.
<quick_response>
  <option key="1" label="Применить миграции" action="Примени предложенные миграции базы данных" />
  <option key="2" label="Показать схему" action="Покажи текущую схему таблиц" />
  <option key="3" label="Отменить" action="Отмени изменения" />
</quick_response>`;

    const { cleanText, options } = extractQuickResponses(rawContent);

    assert.equal(options.length, 3);
    assert.equal(options[0].label, 'Применить миграции');
    assert.equal(options[0].action, 'Примени предложенные миграции базы данных');
    assert.equal(options[0].key, '1');
    assert.equal(options[1].label, 'Показать схему');
    assert.equal(options[2].label, 'Отменить');

    // Verification: cleaned text has no XML tags
    assert.ok(!cleanText.includes('<quick_response>'));
    assert.ok(!cleanText.includes('</quick_response>'));
    assert.ok(!cleanText.includes('<option'));
    assert.equal(cleanText, 'Отличный вопрос! Я могу помочь с этим несколькими способами.');
  });

  it('should parse body-format <option> tags inside <quick_responses>', () => {
    const rawContent = `План готов.
<quick_responses>
  <option label="Продолжить">Да, продолжаем выполнение шага 2</option>
  <option label="Сменить фокус">Переключись на оптимизацию памяти</option>
</quick_responses>`;

    const { cleanText, options } = extractQuickResponses(rawContent);

    assert.equal(options.length, 2);
    assert.equal(options[0].label, 'Продолжить');
    assert.equal(options[0].action, 'Да, продолжаем выполнение шага 2');
    assert.equal(options[1].label, 'Сменить фокус');
    assert.equal(options[1].action, 'Переключись на оптимизацию памяти');
    assert.equal(cleanText, 'План готов.');
  });

  it('should parse pipe-delimited fallback suggestions inside <quick_response>', () => {
    const rawContent = `Куда двигаемся?
<quick_response>
1. Подробнее: Расскажи подробнее про эту архитектуру
2. Тесты: Запусти тестовый набор
3. Готово: Заверши сессию
</quick_response>`;

    const { cleanText, options } = extractQuickResponses(rawContent);

    assert.equal(options.length, 3);
    assert.equal(options[0].label, 'Подробнее');
    assert.equal(options[0].action, 'Расскажи подробнее про эту архитектуру');
    assert.equal(options[1].label, 'Тесты');
    assert.equal(options[1].action, 'Запусти тестовый набор');
    assert.equal(cleanText, 'Куда двигаемся?');
  });

  it('should cleanly strip unclosed/streaming <quick_response> tags in cleanContent', () => {
    const streamingContent = `Генерирую ответ... <quick_response><option label="Продолжить"`;
    const cleaned = cleanContent(streamingContent);
    assert.ok(!cleaned.includes('<quick_response'));
    assert.equal(cleaned, 'Генерирую ответ...');
  });

  it('should cap quick responses at 4 items for clean UI rendering', () => {
    const manyOptions = `Выбери шаг:
<quick_response>
  <option label="1" action="a1" />
  <option label="2" action="a2" />
  <option label="3" action="a3" />
  <option label="4" action="a4" />
  <option label="5" action="a5" />
  <option label="6" action="a6" />
  <option label="7" action="a7" />
  <option label="8" action="a8" />
</quick_response>`;

    const { options } = extractQuickResponses(manyOptions);
    assert.equal(options.length, 4);
  });
});
