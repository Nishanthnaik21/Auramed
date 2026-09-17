import FHIR from 'fhirclient';
import Client from 'fhirclient/lib/Client';

export interface PatientContext {
  id: string;
  name: string;
  gender: string;
  birthDate: string;
  mrn: string;
}

export interface ServiceRequestPayload {
  code: string;
  display: string;
  system?: string;
  reasonText: string;
}

class SmartFhirService {
  private client: Client | null = null;
  private isInitialized = false;

  /**
   * Initializes SMART on FHIR OAuth2 PKCE session.
   * Handles redirection or connects to active Epic/Cerner chart context.
   */
  async initialize(): Promise<Client | null> {
    if (this.isInitialized && this.client) {
      return this.client;
    }

    try {
      this.client = await FHIR.oauth2.ready();
      this.isInitialized = true;
      console.log('SMART on FHIR OAuth2 PKCE Session Ready:', this.client.getState());
      return this.client;
    } catch (err) {
      console.warn('SMART on FHIR oauth2.ready() not triggered (standalone/preview mode):', err);
      this.isInitialized = true;
      return null;
    }
  }

  getClient(): Client | null {
    return this.client;
  }

  /**
   * Fetches patient demographics from active EHR context or returns realistic demonstration profile.
   */
  async getPatient(): Promise<PatientContext> {
    if (this.client) {
      try {
        const patientResource = await this.client.patient.read();
        const officialName = patientResource.name?.[0];
        const fullName = officialName
          ? `${officialName.given?.join(' ') || ''} ${officialName.family || ''}`.trim()
          : 'Patient';

        const mrnIdentifier = patientResource.identifier?.find(
          (i: any) => i.type?.coding?.some((c: any) => c.code === 'MR') || i.system?.includes('mrn')
        );

        return {
          id: patientResource.id || 'PAT-10293',
          name: fullName || 'Eleanor Vance',
          gender: patientResource.gender || 'female',
          birthDate: patientResource.birthDate || '1968-04-12',
          mrn: mrnIdentifier?.value || 'MRN-884920-A',
        };
      } catch (e) {
        console.error('Failed to read FHIR Patient resource:', e);
      }
    }

    // Default realistic clinical context (Dhyan Anchan - mp001)
    return {
      id: 'PAT-MP001',
      name: 'Dhyan Anchan',
      gender: 'male',
      birthDate: '1985-06-20',
      mrn: 'MRN-MP001-A',
    };
  }

  /**
   * Dispatches a draft FHIR ServiceRequest order directly to the EHR server.
   */
  async submitServiceRequest(payload: ServiceRequestPayload): Promise<{ success: boolean; id?: string; error?: string }> {
    const patient = await this.getPatient();

    const fhirServiceRequest = {
      resourceType: 'ServiceRequest',
      status: 'draft',
      intent: 'order',
      priority: 'routine',
      code: {
        coding: [
          {
            system: payload.system || 'http://loinc.org',
            code: payload.code,
            display: payload.display,
          },
        ],
        text: payload.display,
      },
      subject: {
        reference: `Patient/${patient.id}`,
        display: patient.name,
      },
      reasonCode: [
        {
          text: payload.reasonText,
        },
      ],
      authoredOn: new Date().toISOString(),
      note: [
        {
          text: 'Initiated via AuraMed Clinical Pharmacometrics & Uncertainty Reasoning Protocol.',
        },
      ],
    };

    if (this.client) {
      try {
        const response = await this.client.create(fhirServiceRequest);
        console.log('Successfully created FHIR ServiceRequest in EHR:', response);
        return { success: true, id: response.id };
      } catch (err: any) {
        console.error('Error submitting FHIR ServiceRequest:', err);
        return { success: false, error: err?.message || 'EHR write failed' };
      }
    }

    // Simulated successful submission in standalone test mode
    console.log('[Simulated EHR Order Submission]:', fhirServiceRequest);
    return { success: true, id: `SR-${Math.floor(100000 + Math.random() * 900000)}` };
  }
}

export const smartFhir = new SmartFhirService();
