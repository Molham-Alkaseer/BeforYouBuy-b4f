import { useEffect, useRef, useState, type FormEvent } from 'react';
import { authApi } from '../services/auth-api';
import type { RegisterInput, SafeUser } from '../types';
import { validateRegister, registerErrorsFromApi } from '../features/auth-forms/authValidation';
import { readApiError } from '../features/items/apiError';
import AuthField from '../features/auth-forms/AuthField';
import '../features/auth-forms/auth-forms.css';

const empty: RegisterInput = { name: '', email: '', password: '' };

export default function FamilyPage() {
  const [members, setMembers] = useState<SafeUser[]>([]);
  const [values, setValues] = useState(empty);
  const [errors, setErrors] = useState<Partial<Record<keyof RegisterInput, string>>>({});
  const [error, setError] = useState('');
  const [listError, setListError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [retry, setRetry] = useState(0);
  const pending = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setListError('');
    authApi.listMembers().then(result => {
      if (!cancelled) setMembers(result.items);
    }).catch(failure => {
      if (!cancelled) setListError(readApiError(failure).message);
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [retry]);

  async function addMember(event: FormEvent) {
    event.preventDefault();
    if (pending.current || loading) return;
    const invalid = validateRegister(values);
    setErrors(invalid);
    setError('');
    setSuccess('');
    if (Object.keys(invalid).length) return;
    pending.current = true;
    setSaving(true);
    try {
      const member = await authApi.addMember(values);
      if (!mounted.current) return;
      setMembers(current => [...current, member]);
      setValues(empty);
      setSuccess(`${member.name} can now sign in with their email and the password you set. They can view this household only.`);
    } catch (failure) {
      if (!mounted.current) return;
      const problem = readApiError(failure);
      setErrors(registerErrorsFromApi(problem.fieldErrors));
      setError(problem.message);
    } finally {
      pending.current = false;
      if (mounted.current) setSaving(false);
    }
  }

  return <section className="pantry-page">
    <header className="byb-page-header"><div>
      <h1>Family members</h1>
      <p>Add accounts for your family. Members can view your pantry, shopping list and history; admins manage changes.</p>
    </div></header>
    <div className="byb-panel">
      <h2>Add a family member</h2>
      <p>Use an email that is not already registered. Set a password and share it directly with that person. This form creates a member account in your household.</p>
      <form className="auth-form" onSubmit={addMember} noValidate>
        {error && <p role="alert" className="auth-error-summary">{error}</p>}
        {success && <p role="status" className="byb-message">{success}</p>}
        {(['name', 'email', 'password'] as const).map(field => <AuthField
          key={field} id={`member-${field}`} label={field === 'name' ? 'Name' : field === 'email' ? 'Email' : 'Password'} error={errors[field]}>
          {inputProps => <input {...inputProps} name={field}
            type={field === 'password' ? 'password' : field === 'email' ? 'email' : 'text'}
            autoComplete={field === 'password' ? 'new-password' : 'off'}
            value={values[field]} disabled={saving}
            onChange={event => setValues(current => ({ ...current, [field]: event.target.value }))} />}
        </AuthField>)}
        <p className="byb-muted">Password: at least 8 characters, at most 72 UTF-8 bytes.</p>
        <button className="auth-submit" disabled={saving || loading}>{saving ? 'Adding…' : 'Add member'}</button>
      </form>
    </div>
    <div className="byb-panel">
      <h2>Your household</h2>
      {loading && <p role="status">Loading family members…</p>}
      {listError && <div role="alert"><p>{listError}</p><button disabled={saving} onClick={() => setRetry(value => value + 1)}>Retry</button></div>}
      {!loading && !listError && <ul>{members.map(member => <li key={member.id}>
        <strong>{member.name}</strong> — {member.email} · {member.householdRole === 'member' ? 'Member · View only' : 'Admin'}
      </li>)}</ul>}
    </div>
  </section>;
}
