import { Injectable, Logger } from '@nestjs/common';
import { google, people_v1 } from 'googleapis';
import { OAuthService } from '../oauth/oauth.service';
import { GoogleClientService } from '../oauth/google-client.service';

export interface Contact {
  id: string;
  resourceName: string;
  name: string;
  givenName?: string;
  familyName?: string;
  email?: string;
  phone?: string;
  photoUrl?: string;
  organization?: string;
  jobTitle?: string;
}

@Injectable()
export class ContactsService {
  private readonly logger = new Logger(ContactsService.name);

  constructor(
    private oauthService: OAuthService,
    private googleClient: GoogleClientService,
  ) {}

  /**
   * Get an authenticated People API client
   */
  private async getPeopleClient(userId: string): Promise<people_v1.People> {
    const accessToken = await this.oauthService.getValidAccessToken(userId);
    const auth = this.googleClient.createAuthenticatedClient({ accessToken });
    return google.people({ version: 'v1', auth });
  }

  /**
   * Format a person resource to our Contact type
   */
  private formatContact(person: people_v1.Schema$Person): Contact {
    const name = person.names?.[0];
    const email = person.emailAddresses?.[0];
    const phone = person.phoneNumbers?.[0];
    const photo = person.photos?.[0];
    const org = person.organizations?.[0];

    return {
      id: person.resourceName?.split('/').pop() || '',
      resourceName: person.resourceName || '',
      name: name?.displayName || email?.value || 'Unknown',
      givenName: name?.givenName || undefined,
      familyName: name?.familyName || undefined,
      email: email?.value || undefined,
      phone: phone?.value || undefined,
      photoUrl: photo?.url || undefined,
      organization: org?.name || undefined,
      jobTitle: org?.title || undefined,
    };
  }

  /**
   * List contacts
   */
  async listContacts(
    userId: string,
    options: {
      pageSize?: number;
      pageToken?: string;
    } = {},
  ): Promise<{ contacts: Contact[]; nextPageToken?: string }> {
    const people = await this.getPeopleClient(userId);

    const response = await people.people.connections.list({
      resourceName: 'people/me',
      pageSize: options.pageSize || 100,
      pageToken: options.pageToken,
      personFields: 'names,emailAddresses,phoneNumbers,photos,organizations',
      sortOrder: 'FIRST_NAME_ASCENDING',
    });

    const contacts = (response.data.connections || []).map((person) =>
      this.formatContact(person),
    );

    return {
      contacts,
      nextPageToken: response.data.nextPageToken || undefined,
    };
  }

  /**
   * Search contacts by query
   */
  async searchContacts(userId: string, query: string): Promise<Contact[]> {
    const people = await this.getPeopleClient(userId);

    const response = await people.people.searchContacts({
      query,
      readMask: 'names,emailAddresses,phoneNumbers,photos,organizations',
      pageSize: 30,
    });

    return (response.data.results || [])
      .filter((result) => result.person)
      .map((result) => this.formatContact(result.person!));
  }

  /**
   * Get a single contact by resource name
   */
  async getContact(userId: string, resourceName: string): Promise<Contact> {
    const people = await this.getPeopleClient(userId);

    const response = await people.people.get({
      resourceName,
      personFields: 'names,emailAddresses,phoneNumbers,photos,organizations',
    });

    return this.formatContact(response.data);
  }

  /**
   * Get contact by email
   */
  async getContactByEmail(userId: string, email: string): Promise<Contact | null> {
    const contacts = await this.searchContacts(userId, email);
    return contacts.find((c) => c.email?.toLowerCase() === email.toLowerCase()) || null;
  }

  /**
   * Get frequently contacted people
   */
  async getFrequentContacts(userId: string, maxResults: number = 10): Promise<Contact[]> {
    const people = await this.getPeopleClient(userId);

    // Use "other contacts" which includes frequently emailed contacts
    const response = await people.otherContacts.list({
      pageSize: maxResults,
      readMask: 'names,emailAddresses,phoneNumbers,photos',
    });

    return (response.data.otherContacts || []).map((person) =>
      this.formatContact(person),
    );
  }

  /**
   * Get contact count
   */
  async getContactCount(userId: string): Promise<number> {
    const people = await this.getPeopleClient(userId);

    const response = await people.people.connections.list({
      resourceName: 'people/me',
      pageSize: 1,
      personFields: 'names',
    });

    return response.data.totalPeople || 0;
  }
}
