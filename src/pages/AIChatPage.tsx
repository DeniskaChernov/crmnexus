import React from "react";
import { motion } from "motion/react";
import { CrmAiChatPanel } from "../components/crm/CrmAiChatPanel.tsx";

export default function AIChatPage() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="px-0 py-2 md:py-3"
    >
      <CrmAiChatPanel variant="page" />
    </motion.div>
  );
}
