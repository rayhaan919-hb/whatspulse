'use client';

import React, { useState, useEffect } from 'react';
import { Contact } from '@/types/crm';

interface ContactsTableProps {
  contacts: Contact[];
  onOpenChatWithContact: (contactId: string) => void;
  onAddContact: (contact: Partial<Contact>) => void;
}

export const ContactsTable: React.FC<ContactsTableProps> = ({
  contacts,
  onOpenChatWithContact,
  onAddContact,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTagFilter, setSelectedTagFilter] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);

  const [name, setName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [tagsInput, setTagsInput] = useState('');

  // Close Add Contact modal on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showAddModal) {
        setShowAddModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showAddModal]);

  const allTags = Array.from(new Set(contacts.flatMap((c) => c.tags)));

  const filteredContacts = contacts.filter((c) => {
    if (selectedTagFilter !== 'all' && !c.tags.includes(selectedTagFilter)) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = c.name.toLowerCase().includes(q);
      const matchPhone = c.phoneNumber.includes(q);
      const matchEmail = (c.email || '').toLowerCase().includes(q);
      return matchName || matchPhone || matchEmail;
    }
    return true;
  });

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phoneNumber.trim()) return;

    onAddContact({
      name: name.trim(),
      phoneNumber: phoneNumber.startsWith('+') ? phoneNumber.trim() : `+${phoneNumber.trim()}`,
      email: email.trim() || undefined,
      tags: tagsInput.split(',').map((t) => t.trim()).filter(Boolean),
      customAttributes: {},
    });

    setName('');
    setPhoneNumber('');
    setEmail('');
    setTagsInput('');
    setShowAddModal(false);
  };

  const handleExportCSV = () => {
    const headers = ['Name', 'Phone Number', 'Email', 'Tags', 'Last Interaction'];
    const rows = filteredContacts.map((c) => [
      `"${c.name}"`,
      `"${c.phoneNumber}"`,
      `"${c.email || ''}"`,
      `"${c.tags.join('; ')}"`,
      `"${c.lastInteractionAt}"`,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'whatspulse_contacts.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex-1 min-w-0 overflow-y-auto p-6 md:p-8 bg-[#fffcec] select-none">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="font-eyebrow text-[10px] text-[#3139fb] font-bold mb-1">
              CUSTOMER DIRECTORY
            </div>
            <h2 className="text-2xl md:text-3xl font-bold text-black tracking-[-1.2px]">
              Contacts &amp; Tags
            </h2>
            <p className="text-sm text-[#696969] mt-1">
              Manage your WhatsApp customers, organize them with tags, and start 1-on-1 chats.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            {contacts.length > 0 && (
              <button
                onClick={handleExportCSV}
                className="px-4 py-2.5 bg-[#f7f4e3] border border-black/15 hover:border-black text-black font-semibold text-xs rounded-[8px] transition-all flex items-center gap-1.5"
              >
                <span>📥</span>
                <span>Export CSV</span>
              </button>
            )}
            <button
              onClick={() => setShowAddModal(true)}
              className="px-5 py-2.5 bg-black hover:bg-[#000354] text-[#fffcec] font-bold text-xs rounded-[8px] transition-all shadow-xs flex items-center gap-2"
            >
              <span>+</span>
              <span>Add Contact</span>
            </button>
          </div>
        </div>

        {/* Search & Tag Filter Bar */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Search by name, phone (+1...), or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-[#f7f4e3] text-black border border-black/15 rounded-[8px] text-xs outline-none focus:border-[#3139fb] focus:bg-[#fffcec]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#696969] hover:text-black text-xs font-bold"
              >
                ✕
              </button>
            )}
          </div>

          <select
            value={selectedTagFilter}
            onChange={(e) => setSelectedTagFilter(e.target.value)}
            className="px-3.5 py-2.5 bg-[#f7f4e3] text-black border border-black/15 rounded-[8px] text-xs outline-none focus:border-[#3139fb] font-semibold"
          >
            <option value="all">All Tags ({allTags.length})</option>
            {allTags.map((tag) => (
              <option key={tag} value={tag}>
                Tag: {tag}
              </option>
            ))}
          </select>
        </div>

        {/* Contacts Table or Empty State */}
        {filteredContacts.length === 0 ? (
          <div className="p-10 rounded-[12px] bg-[#f7f4e3] border border-black/15 text-center space-y-4">
            <div className="w-12 h-12 rounded-xl bg-black text-[#fffcec] flex items-center justify-center text-xl mx-auto">
              👥
            </div>
            <div className="max-w-md mx-auto space-y-1">
              <h3 className="text-base font-bold text-black">
                {contacts.length === 0 ? 'No Contacts Added Yet' : 'No Matching Contacts Found'}
              </h3>
              <p className="text-xs text-[#696969] leading-relaxed">
                {contacts.length === 0
                  ? 'Contacts are created automatically when someone messages your WhatsApp number, or you can add a contact manually below.'
                  : 'Try clearing your search query or selecting a different tag filter.'}
              </p>
            </div>
            {contacts.length === 0 && (
              <button
                onClick={() => setShowAddModal(true)}
                className="px-5 py-2.5 bg-black hover:bg-[#000354] text-[#fffcec] font-bold text-xs rounded-[8px] transition-all"
              >
                + Add Your First Contact
              </button>
            )}
          </div>
        ) : (
          <div className="bg-[#f7f4e3] rounded-[12px] border border-black/15 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[640px]">
                <thead className="bg-black/5 text-[#696969] border-b border-black/10">
                  <tr>
                    <th className="p-4 font-eyebrow text-[10px]">CUSTOMER</th>
                    <th className="p-4 font-eyebrow text-[10px]">WHATSAPP NUMBER</th>
                    <th className="p-4 font-eyebrow text-[10px]">TAGS</th>
                    <th className="p-4 font-eyebrow text-[10px]">LAST ACTIVE</th>
                    <th className="p-4 text-right font-eyebrow text-[10px]">ACTION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/10">
                  {filteredContacts.map((contact) => (
                    <tr
                      key={contact.id}
                      className="hover:bg-[#fffcec] transition-colors"
                    >
                      <td className="p-4 flex items-center gap-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={
                            contact.avatarUrl ||
                            'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'
                          }
                          alt={contact.name}
                          className="w-9 h-9 rounded-full object-cover border border-black/15 shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="font-bold text-black text-xs truncate">
                            {contact.name}
                          </div>
                          {contact.email && (
                            <div className="text-[11px] text-[#696969] truncate">
                              {contact.email}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="p-4 font-mono text-xs text-black whitespace-nowrap">
                        {contact.phoneNumber}
                      </td>
                      <td className="p-4">
                        <div className="flex flex-wrap gap-1.5">
                          {contact.tags.length === 0 ? (
                            <span className="text-[11px] text-[#696969]">No tags</span>
                          ) : (
                            contact.tags.map((tag) => (
                              <span
                                key={tag}
                                className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#fffcec] border border-black/15 text-black"
                              >
                                {tag}
                              </span>
                            ))
                          )}
                        </div>
                      </td>
                      <td className="p-4 text-[11px] text-[#696969] whitespace-nowrap">
                        {new Date(contact.lastInteractionAt).toLocaleDateString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="p-4 text-right whitespace-nowrap">
                        <button
                          onClick={() => onOpenChatWithContact(contact.id)}
                          className="px-3.5 py-1.5 bg-black hover:bg-[#000354] text-[#fffcec] font-bold rounded-[8px] transition-all text-xs"
                        >
                          Message ➔
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Add Contact Modal with Backdrop & Escape Close */}
        {showAddModal && (
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50"
            onClick={() => setShowAddModal(false)}
          >
            <div
              className="bg-[#fffcec] rounded-[14px] max-w-md w-full p-6 shadow-2xl border border-black/20 space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-black/10 pb-3">
                <div>
                  <div className="font-eyebrow text-[9px] text-[#3139fb] font-bold">
                    NEW CUSTOMER
                  </div>
                  <h3 className="font-bold text-base text-black">
                    Add WhatsApp Contact
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-2.5 py-1 rounded-[6px] bg-[#f7f4e3] hover:bg-black hover:text-[#fffcec] text-black font-bold text-xs border border-black/15 transition-colors"
                >
                  Close ✕
                </button>
              </div>

              <form onSubmit={handleAddSubmit} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-bold text-black mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. David Miller"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full p-2.5 rounded-[8px] border border-black/20 bg-[#f7f4e3] text-xs focus:border-[#3139fb] focus:bg-[#fffcec] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-black mb-1">
                    WhatsApp Number (with country code)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="+14155552671"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className="w-full p-2.5 rounded-[8px] border border-black/20 bg-[#f7f4e3] text-xs font-mono focus:border-[#3139fb] focus:bg-[#fffcec] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-black mb-1">
                    Email Address (Optional)
                  </label>
                  <input
                    type="email"
                    placeholder="david@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full p-2.5 rounded-[8px] border border-black/20 bg-[#f7f4e3] text-xs focus:border-[#3139fb] focus:bg-[#fffcec] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-black mb-1">
                    Tags (comma separated)
                  </label>
                  <input
                    type="text"
                    placeholder="VIP Client, Wholesale, Lead"
                    value={tagsInput}
                    onChange={(e) => setTagsInput(e.target.value)}
                    className="w-full p-2.5 rounded-[8px] border border-black/20 bg-[#f7f4e3] text-xs focus:border-[#3139fb] focus:bg-[#fffcec] outline-none"
                  />
                </div>

                <div className="pt-2 flex justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 text-xs font-semibold text-[#696969] hover:text-black"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-[8px] bg-black hover:bg-[#000354] text-[#fffcec] font-bold text-xs shadow-xs transition-all"
                  >
                    Save Contact
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
