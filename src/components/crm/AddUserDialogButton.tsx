import React, { useState } from 'react';
import { Button } from '../ui/button';
import { Users } from 'lucide-react';
import { AddUserDialog } from './AddUserDialog';

interface AddUserDialogButtonProps {
  onUserAdded?: () => void;
}

export function AddUserDialogButton({ onUserAdded }: AddUserDialogButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Users className="h-4 w-4 mr-2" />
        Добавить пользователя
      </Button>
      <AddUserDialog 
        open={open} 
        onOpenChange={setOpen}
        onUserAdded={() => {
          if (onUserAdded) {
            onUserAdded();
          }
        }}
      />
    </>
  );
}