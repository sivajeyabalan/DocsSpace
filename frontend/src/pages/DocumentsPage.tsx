import { useEffect, useMemo, useState, type FormEvent } from 'react';
import * as api from '../api/client';
import { AppShell } from '../components/AppShell';
import { useAuth } from '../hooks/useAuth';
import type { DocumentGrant, DocumentRecord, Team, TenantMember } from '../types/collab';

type Visibility = 'private' | 'team' | 'tenant';
type Permission = 'view' | 'edit' | 'admin';

export function DocumentsPage() {
  const { session } = useAuth();
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [members, setMembers] = useState<TenantMember[]>([]);
  const [grants, setGrants] = useState<DocumentGrant[]>([]);
  const [selectedDocumentId, setSelectedDocumentId] = useState('');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [visibility, setVisibility] = useState<Visibility>('private');
  const [grantType, setGrantType] = useState<'user' | 'team'>('user');
  const [grantPrincipalId, setGrantPrincipalId] = useState('');
  const [grantPermission, setGrantPermission] = useState<Permission>('view');
  const [error, setError] = useState<string | null>(null);

  async function loadBase() {
    if (!session) {
      return;
    }
    try {
      const [docs, teamsResult, membersResult] = await Promise.all([
        api.listDocuments({
          accessToken: session.accessToken,
          tenantSlug: session.tenant.slug,
        }),
        api.listTeams({
          accessToken: session.accessToken,
          tenantSlug: session.tenant.slug,
        }),
        api.listTenantMembers({
          accessToken: session.accessToken,
          tenantSlug: session.tenant.slug,
        }),
      ]);
      setDocuments(docs);
      setTeams(teamsResult);
      setMembers(membersResult);
      if (docs.length > 0 && !selectedDocumentId) {
        setSelectedDocumentId(docs[0].id);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load documents');
    }
  }

  async function loadGrants(documentId: string) {
    if (!session || !documentId) {
      setGrants([]);
      return;
    }
    try {
      const result = await api.listDocumentGrants({
        accessToken: session.accessToken,
        tenantSlug: session.tenant.slug,
        documentId,
      });
      setGrants(result);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load grants');
    }
  }

  useEffect(() => {
    void loadBase();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.tenant.slug]);

  useEffect(() => {
    void loadGrants(selectedDocumentId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDocumentId, session?.tenant.slug]);

  const selectedDocument = useMemo(
    () => documents.find((document) => document.id === selectedDocumentId) ?? null,
    [documents, selectedDocumentId],
  );

  const principalOptions =
    grantType === 'user'
      ? members.map((member) => ({ id: member.userId, label: member.user.email }))
      : teams.map((team) => ({ id: team.id, label: team.name }));

  async function onCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session) {
      return;
    }
    try {
      await api.createDocument({
        accessToken: session.accessToken,
        tenantSlug: session.tenant.slug,
        title,
        content,
        visibility,
      });
      setTitle('');
      setContent('');
      setVisibility('private');
      await loadBase();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Failed to create document');
    }
  }

  async function onUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session || !selectedDocument) {
      return;
    }
    try {
      await api.updateDocument({
        accessToken: session.accessToken,
        tenantSlug: session.tenant.slug,
        documentId: selectedDocument.id,
        title: selectedDocument.title,
        content: selectedDocument.content,
        visibility: selectedDocument.visibility,
      });
      await loadBase();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Failed to update document');
    }
  }

  async function onDelete(documentId: string) {
    if (!session) {
      return;
    }
    try {
      await api.deleteDocument({
        accessToken: session.accessToken,
        tenantSlug: session.tenant.slug,
        documentId,
      });
      if (selectedDocumentId === documentId) {
        setSelectedDocumentId('');
      }
      await loadBase();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Failed to delete document');
    }
  }

  async function onGrant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session || !selectedDocumentId || !grantPrincipalId) {
      return;
    }
    try {
      await api.grantDocumentPermission({
        accessToken: session.accessToken,
        tenantSlug: session.tenant.slug,
        documentId: selectedDocumentId,
        principalType: grantType,
        principalId: grantPrincipalId,
        permission: grantPermission,
      });
      await loadGrants(selectedDocumentId);
    } catch (grantError) {
      setError(grantError instanceof Error ? grantError.message : 'Failed to grant permission');
    }
  }

  async function onRevoke(grant: DocumentGrant) {
    if (!session || !selectedDocumentId) {
      return;
    }
    try {
      await api.revokeDocumentPermission({
        accessToken: session.accessToken,
        tenantSlug: session.tenant.slug,
        documentId: selectedDocumentId,
        principalType: grant.principalType,
        principalId: grant.principalId,
      });
      await loadGrants(selectedDocumentId);
    } catch (revokeError) {
      setError(revokeError instanceof Error ? revokeError.message : 'Failed to revoke permission');
    }
  }

  return (
    <AppShell>
      <h2 className="text-xl font-semibold text-ink-900">Documents and ACL</h2>
      <p className="mt-2 text-sm text-slate-600">
        Create documents, set visibility, and manage user/team grants.
      </p>
      {error ? <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

      <form className="mt-5 grid gap-3 rounded-xl border border-slate-200 p-4" onSubmit={onCreate}>
        <div className="grid gap-3 sm:grid-cols-3">
          <input
            className="docspace-input sm:col-span-2"
            placeholder="Document title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            required
          />
          <select
            className="docspace-input"
            value={visibility}
            onChange={(event) => setVisibility(event.target.value as Visibility)}
          >
            <option value="private">private</option>
            <option value="team">team</option>
            <option value="tenant">tenant</option>
          </select>
        </div>
        <textarea
          className="docspace-input min-h-28"
          placeholder="Document content"
          value={content}
          onChange={(event) => setContent(event.target.value)}
        />
        <button className="docspace-button w-auto px-4" type="submit">
          Create Document
        </button>
      </form>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 p-4">
          <h3 className="text-sm font-semibold text-slate-800">Document list</h3>
          <ul className="mt-3 space-y-2">
            {documents.map((document) => (
              <li key={document.id} className="rounded-lg border border-slate-100 p-3">
                <div className="flex items-center justify-between gap-3">
                  <button
                    type="button"
                    className={`text-left text-sm ${
                      selectedDocumentId === document.id ? 'text-docspace-700' : 'text-slate-800'
                    }`}
                    onClick={() => setSelectedDocumentId(document.id)}
                  >
                    <p className="font-medium">{document.title}</p>
                    <p className="text-xs text-slate-500">{document.visibility}</p>
                  </button>
                  <button
                    type="button"
                    className="rounded bg-rose-600 px-2 py-1 text-xs text-white"
                    onClick={() => void onDelete(document.id)}
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl border border-slate-200 p-4">
          <h3 className="text-sm font-semibold text-slate-800">Selected document</h3>
          {selectedDocument ? (
            <form className="mt-3 space-y-3" onSubmit={onUpdate}>
              <input
                className="docspace-input"
                value={selectedDocument.title}
                onChange={(event) =>
                  setDocuments((previous) =>
                    previous.map((item) =>
                      item.id === selectedDocument.id
                        ? { ...item, title: event.target.value }
                        : item,
                    ),
                  )
                }
              />
              <select
                className="docspace-input"
                value={selectedDocument.visibility}
                onChange={(event) =>
                  setDocuments((previous) =>
                    previous.map((item) =>
                      item.id === selectedDocument.id
                        ? { ...item, visibility: event.target.value as Visibility }
                        : item,
                    ),
                  )
                }
              >
                <option value="private">private</option>
                <option value="team">team</option>
                <option value="tenant">tenant</option>
              </select>
              <textarea
                className="docspace-input min-h-28"
                value={selectedDocument.content}
                onChange={(event) =>
                  setDocuments((previous) =>
                    previous.map((item) =>
                      item.id === selectedDocument.id
                        ? { ...item, content: event.target.value }
                        : item,
                    ),
                  )
                }
              />
              <button className="docspace-button w-auto px-4" type="submit">
                Save Changes
              </button>
            </form>
          ) : (
            <p className="mt-3 text-sm text-slate-500">Select a document to edit and grant permissions.</p>
          )}
        </section>
      </div>

      <section className="mt-5 rounded-xl border border-slate-200 p-4">
        <h3 className="text-sm font-semibold text-slate-800">ACL grants</h3>
        <form className="mt-3 grid gap-2 sm:grid-cols-4" onSubmit={onGrant}>
          <select
            className="docspace-input"
            value={grantType}
            onChange={(event) => {
              const nextType = event.target.value as 'user' | 'team';
              setGrantType(nextType);
              setGrantPrincipalId('');
            }}
          >
            <option value="user">user</option>
            <option value="team">team</option>
          </select>
          <select
            className="docspace-input"
            value={grantPrincipalId}
            onChange={(event) => setGrantPrincipalId(event.target.value)}
          >
            <option value="">Select principal</option>
            {principalOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
          <select
            className="docspace-input"
            value={grantPermission}
            onChange={(event) => setGrantPermission(event.target.value as Permission)}
          >
            <option value="view">view</option>
            <option value="edit">edit</option>
            <option value="admin">admin</option>
          </select>
          <button className="docspace-button" type="submit" disabled={!selectedDocumentId}>
            Grant
          </button>
        </form>

        <ul className="mt-4 space-y-2">
          {grants.map((grant) => (
            <li key={grant.id} className="flex items-center justify-between rounded-lg border border-slate-100 p-2 text-sm">
              <span className="text-slate-700">
                {grant.principalType}:{grant.principalId} - {grant.permission}
              </span>
              <button
                type="button"
                className="rounded bg-rose-600 px-2 py-1 text-xs text-white"
                onClick={() => void onRevoke(grant)}
              >
                Revoke
              </button>
            </li>
          ))}
        </ul>
      </section>
    </AppShell>
  );
}
