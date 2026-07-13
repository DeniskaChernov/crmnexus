import React from 'react';
import { BttCrmModuleShell } from '../components/btt-ref/BttCrmModuleShell.tsx';
import { CrmAiChatPanel } from '../components/crm/CrmAiChatPanel.tsx';

export default function AIChatPage() {
  return (
    <BttCrmModuleShell tag="CRM ИИ" title="AI-ассистент" subtitle="Вопросы по заказам, складу и сделкам">
      <CrmAiChatPanel variant="page" />
    </BttCrmModuleShell>
  );
}
