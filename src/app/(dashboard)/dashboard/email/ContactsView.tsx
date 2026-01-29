'use client';

import { useState, useEffect, useCallback } from 'react';
import styles from './email.module.css';
import { 
  FiSearch, FiUser, FiMail, FiPhone, FiMapPin, FiPlus,
  FiRefreshCw, FiX, FiStar, FiEdit2, FiMoreVertical, FiMessageSquare
} from 'react-icons/fi';

interface Contact {
  resourceName: string;
  name: string;
  email?: string;
  phone?: string;
  organization?: string;
  photoUrl?: string;
  address?: string;
  notes?: string;
  isFrequent?: boolean;
}

interface ContactsViewProps {
  accountEmail: string;
}

export default function ContactsView({ accountEmail }: ContactsViewProps) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [frequentContacts, setFrequentContacts] = useState<Contact[]>([]);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [totalCount, setTotalCount] = useState(0);
  const [activeFilter, setActiveFilter] = useState<'all' | 'frequent'>('all');

  const fetchContacts = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/google/contacts?pageSize=100');
      if (response.ok) {
        const data = await response.json();
        setContacts(data.contacts || []);
        setTotalCount(data.totalItems || data.contacts?.length || 0);
      }
    } catch (error) {
      console.error('Failed to fetch contacts:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchFrequentContacts = useCallback(async () => {
    try {
      const response = await fetch('/api/google/contacts/frequent?maxResults=20');
      if (response.ok) {
        const data = await response.json();
        setFrequentContacts(data.contacts || []);
      }
    } catch (error) {
      console.error('Failed to fetch frequent contacts:', error);
    }
  }, []);

  useEffect(() => {
    fetchContacts();
    fetchFrequentContacts();
  }, [fetchContacts, fetchFrequentContacts]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchContacts();
    await fetchFrequentContacts();
    setIsRefreshing(false);
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      await fetchContacts();
      return;
    }
    
    setIsLoading(true);
    try {
      const response = await fetch(`/api/google/contacts/search?q=${encodeURIComponent(searchQuery)}`);
      if (response.ok) {
        const data = await response.json();
        setContacts(data.contacts || []);
      }
    } catch (error) {
      console.error('Failed to search contacts:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const displayedContacts = activeFilter === 'frequent' ? frequentContacts : contacts;

  // Group contacts by first letter
  const groupedContacts = displayedContacts.reduce((groups, contact) => {
    const letter = contact.name.charAt(0).toUpperCase();
    if (!groups[letter]) {
      groups[letter] = [];
    }
    groups[letter].push(contact);
    return groups;
  }, {} as Record<string, Contact[]>);

  const sortedLetters = Object.keys(groupedContacts).sort();

  return (
    <div className={styles.contactsContainer}>
      {/* Contacts Sidebar */}
      <div className={styles.contactsSidebar}>
        {/* Search */}
        <div className={styles.contactsSearch}>
          <FiSearch className={styles.searchIcon} />
          <input
            type="text"
            placeholder="Search contacts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className={styles.searchInput}
          />
          {searchQuery && (
            <button 
              className={styles.clearSearch}
              onClick={() => {
                setSearchQuery('');
                fetchContacts();
              }}
            >
              <FiX />
            </button>
          )}
        </div>

        {/* Filters */}
        <div className={styles.contactsFilters}>
          <button
            className={`${styles.filterButton} ${activeFilter === 'all' ? styles.filterButtonActive : ''}`}
            onClick={() => setActiveFilter('all')}
          >
            All Contacts
            <span className={styles.filterCount}>{totalCount}</span>
          </button>
          <button
            className={`${styles.filterButton} ${activeFilter === 'frequent' ? styles.filterButtonActive : ''}`}
            onClick={() => setActiveFilter('frequent')}
          >
            <FiStar />
            Frequent
          </button>
        </div>

        {/* Actions */}
        <div className={styles.contactsActions}>
          <button 
            className={`${styles.refreshButton} ${isRefreshing ? styles.refreshing : ''}`}
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <FiRefreshCw />
          </button>
          <button className={styles.addContactButton}>
            <FiPlus />
            <span>Add Contact</span>
          </button>
        </div>

        {/* Contacts List */}
        <div className={styles.contactsList}>
          {isLoading ? (
            <div className={styles.contactsLoading}>
              <div className={styles.spinner} />
              <span>Loading contacts...</span>
            </div>
          ) : displayedContacts.length === 0 ? (
            <div className={styles.contactsEmpty}>
              <FiUser className={styles.emptyIcon} />
              <span>No contacts found</span>
            </div>
          ) : (
            sortedLetters.map(letter => (
              <div key={letter} className={styles.contactGroup}>
                <div className={styles.contactGroupHeader}>{letter}</div>
                {groupedContacts[letter].map(contact => (
                  <div
                    key={contact.resourceName}
                    className={`${styles.contactItem} ${selectedContact?.resourceName === contact.resourceName ? styles.contactItemSelected : ''}`}
                    onClick={() => setSelectedContact(contact)}
                  >
                    <div className={styles.contactAvatar}>
                      {contact.photoUrl ? (
                        <img src={contact.photoUrl} alt={contact.name} />
                      ) : (
                        <span>{getInitials(contact.name)}</span>
                      )}
                    </div>
                    <div className={styles.contactItemInfo}>
                      <span className={styles.contactName}>{contact.name}</span>
                      {contact.email && (
                        <span className={styles.contactEmail}>{contact.email}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Contact Detail */}
      <div className={styles.contactDetail}>
        {selectedContact ? (
          <>
            <div className={styles.contactDetailHeader}>
              <div className={styles.contactDetailAvatar}>
                {selectedContact.photoUrl ? (
                  <img src={selectedContact.photoUrl} alt={selectedContact.name} />
                ) : (
                  <span>{getInitials(selectedContact.name)}</span>
                )}
              </div>
              <div className={styles.contactDetailInfo}>
                <h2>{selectedContact.name}</h2>
                {selectedContact.organization && (
                  <span className={styles.contactOrganization}>{selectedContact.organization}</span>
                )}
              </div>
              <div className={styles.contactDetailActions}>
                <button className={styles.contactActionButton}>
                  <FiEdit2 />
                </button>
                <button className={styles.contactActionButton}>
                  <FiMoreVertical />
                </button>
              </div>
            </div>

            <div className={styles.contactDetailBody}>
              {/* Quick Actions */}
              <div className={styles.quickActions}>
                {selectedContact.email && (
                  <a 
                    href={`mailto:${selectedContact.email}`}
                    className={styles.quickAction}
                  >
                    <FiMail />
                    <span>Email</span>
                  </a>
                )}
                {selectedContact.phone && (
                  <a 
                    href={`tel:${selectedContact.phone}`}
                    className={styles.quickAction}
                  >
                    <FiPhone />
                    <span>Call</span>
                  </a>
                )}
                <button className={styles.quickAction}>
                  <FiMessageSquare />
                  <span>Message</span>
                </button>
              </div>

              {/* Contact Info */}
              <div className={styles.contactInfoSection}>
                <h3>Contact Information</h3>
                
                {selectedContact.email && (
                  <div className={styles.contactInfoRow}>
                    <FiMail className={styles.contactInfoIcon} />
                    <div className={styles.contactInfoContent}>
                      <span className={styles.contactInfoLabel}>Email</span>
                      <a href={`mailto:${selectedContact.email}`} className={styles.contactInfoValue}>
                        {selectedContact.email}
                      </a>
                    </div>
                  </div>
                )}

                {selectedContact.phone && (
                  <div className={styles.contactInfoRow}>
                    <FiPhone className={styles.contactInfoIcon} />
                    <div className={styles.contactInfoContent}>
                      <span className={styles.contactInfoLabel}>Phone</span>
                      <a href={`tel:${selectedContact.phone}`} className={styles.contactInfoValue}>
                        {selectedContact.phone}
                      </a>
                    </div>
                  </div>
                )}

                {selectedContact.address && (
                  <div className={styles.contactInfoRow}>
                    <FiMapPin className={styles.contactInfoIcon} />
                    <div className={styles.contactInfoContent}>
                      <span className={styles.contactInfoLabel}>Address</span>
                      <span className={styles.contactInfoValue}>{selectedContact.address}</span>
                    </div>
                  </div>
                )}
              </div>

              {selectedContact.notes && (
                <div className={styles.contactNotesSection}>
                  <h3>Notes</h3>
                  <p>{selectedContact.notes}</p>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className={styles.noContactSelected}>
            <FiUser className={styles.noContactIcon} />
            <h3>Select a Contact</h3>
            <p>Choose a contact from the list to view their details</p>
          </div>
        )}
      </div>
    </div>
  );
}
