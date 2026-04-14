import React, { useState } from 'react';
import { Button } from '../ui/button';
import { EditPipelineDialog } from './EditPipelineDialog';

export function EditPipelineDialogButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        Изменить
      </Button>
      <EditPipelineDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
