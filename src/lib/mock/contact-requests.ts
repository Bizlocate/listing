export type ContactRequestStatus = "pending" | "approved" | "expired";

export interface MockContactRequest {
  id: string;
  requesterName: string;
  requesterNote: string;
  listingAddress: string;
  reason: string;
  tenantOrCompany: string;
  budget: string;
  status: ContactRequestStatus;
  submittedAgo: string;
}

export const MOCK_CONTACT_REQUESTS: MockContactRequest[] = [
  {
    id: "cr-1",
    requesterName: "Amirul Hakim",
    requesterNote: "34 submissions",
    listingAddress: "Danau Niaga 3, GF",
    reason: "I have a tenant",
    tenantOrCompany: "Kopitiam Sri Danau · F&B",
    budget: "RM 4,500 · move in Oct",
    status: "pending",
    submittedAgo: "3h",
  },
  {
    id: "cr-2",
    requesterName: "Nadia Farhana",
    requesterNote: "joined Aug",
    listingAddress: "Wangsa Delima 5",
    reason: "Arrange viewing",
    tenantOrCompany: "—",
    budget: "—",
    status: "pending",
    submittedAgo: "5h",
  },
  {
    id: "cr-3",
    requesterName: "Jason Lee",
    requesterNote: "negotiation",
    listingAddress: "Metro Perdana 8",
    reason: "Rental negotiation",
    tenantOrCompany: "—",
    budget: "—",
    status: "approved",
    submittedAgo: "yesterday",
  },
  {
    id: "cr-4",
    requesterName: "Suresh Kumar",
    requesterNote: "verification",
    listingAddress: "Danau Kota 2",
    reason: "Listing verification",
    tenantOrCompany: "—",
    budget: "—",
    status: "expired",
    submittedAgo: "2d",
  },
];

export function getContactRequestById(id: string): MockContactRequest | undefined {
  return MOCK_CONTACT_REQUESTS.find((request) => request.id === id);
}

export function countPendingContactRequests(): number {
  return MOCK_CONTACT_REQUESTS.filter((request) => request.status === "pending").length;
}
