import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { readApiError } from './apiError';
import { itemApi } from './itemApi';
import type { PantryItem } from './itemTypes';

interface DeleteItemProps {
  item: PantryItem;
}

export default function DeleteItem({ item }: DeleteItemProps) {
  const navigate = useNavigate();
  const [isConfirming, setIsConfirming] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [blockedMessage, setBlockedMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  function startDelete() {
    setBlockedMessage('');
    setErrorMessage('');
    setIsConfirming(true);
  }

  // Cancel only closes the question. No request is sent.
  function cancelDelete() {
    setIsConfirming(false);
  }

  async function confirmDelete() {
    if (isDeleting) {
      return; // a request is already running
    }

    setIsDeleting(true);

    try {
      await itemApi.deletePantryItem(item.id);
      navigate('/pantry'); // 204: the item is gone
    } catch (error) {
      const apiError = readApiError(error);
      setIsConfirming(false);
      setIsDeleting(false);

      if (apiError.code === 'ITEM_HAS_PENDING_ENTRY') {
        setBlockedMessage(apiError.message);
      } else {
        setErrorMessage(apiError.message);
      }
    }
  }

  return (
    <div className="item-delete">
      {!isConfirming && (
        <button type="button" className="item-delete-button" onClick={startDelete}>
          Delete item
        </button>
      )}

      {isConfirming && (
        <div
          className="item-delete-confirm"
          role="group"
          aria-labelledby="item-delete-question"
        >
          <p id="item-delete-question">
            Delete <strong>{item.name}</strong>? This cannot be undone.
          </p>
          <button
            type="button"
            className="item-delete-button"
            onClick={confirmDelete}
            disabled={isDeleting}
          >
            {isDeleting ? 'Deleting...' : 'Yes, delete'}
          </button>
          <button
            type="button"
            onClick={cancelDelete}
            disabled={isDeleting}
            autoFocus
          >
            Cancel
          </button>
        </div>
      )}

      {blockedMessage !== '' && (
        <p role="alert" className="item-delete-blocked">
          {blockedMessage} <Link to="/shopping-list">Go to the shopping list</Link>
        </p>
      )}

      {errorMessage !== '' && (
        <p role="alert" className="item-delete-error">
          {errorMessage}
        </p>
      )}
    </div>
  );
}