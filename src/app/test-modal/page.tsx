'use client';

import { useState } from 'react';
import { DeleteConfirmationModal } from '../super-admin/delete-confirmation-modal';
import { Button } from '@/components/ui/button';

export default function TestModalPage() {
  const [isOpen, setIsOpen] = useState(false);
  const [status, setStatus] = useState('Idle');

  return (
    <div className="p-8">
      <h1 className="text-2xl mb-4">Modal Test Sandbox</h1>
      <Button id="open-modal-btn" onClick={() => setIsOpen(true)}>Open Modal</Button>
      <p className="mt-4 text-green-600 font-bold" id="status-text">Status: {status}</p>

      <DeleteConfirmationModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onConfirm={() => {
          setStatus('Confirmed!');
          setIsOpen(false);
        }}
        title="Test Delete"
        description="This is a test modal."
        expectedConfirmationString="test-org-slug"
        isDeleting={false}
      />
    </div>
  );
}
