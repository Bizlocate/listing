export type OwnerSearchStatus =
  | "need_search"
  | "contacting"
  | "follow_up_later"
  | "wrong_number";

export interface MockOwnerSearchTask {
  id: string;
  address: string;
  status: OwnerSearchStatus;
  note: string;
  assignedTo: string | null;
  foundContact: string | null;
}

export const MOCK_OWNER_SEARCH_TASKS: MockOwnerSearchTask[] = [
  {
    id: "ost-1",
    address: "12A, Jalan Genting Klang",
    status: "contacting",
    note: "Number found · Siti",
    assignedTo: "Siti",
    foundContact: "012-388 4471",
  },
  {
    id: "ost-2",
    address: "5, Jalan Danau Kota 7",
    status: "need_search",
    note: "No number yet · 2 days",
    assignedTo: null,
    foundContact: null,
  },
  {
    id: "ost-3",
    address: "18, Jalan Danau Niaga 2",
    status: "contacting",
    note: "Contacting · Siti",
    assignedTo: "Siti",
    foundContact: "013-772 1180",
  },
  {
    id: "ost-4",
    address: "31, Wangsa Delima 9",
    status: "follow_up_later",
    note: "Call back after 6pm · Chan",
    assignedTo: "Chan",
    foundContact: null,
  },
  {
    id: "ost-5",
    address: "2, Metro Perdana 4",
    status: "wrong_number",
    note: "Banner number is a contractor",
    assignedTo: null,
    foundContact: null,
  },
];

export function getOwnerSearchTaskById(id: string): MockOwnerSearchTask | undefined {
  return MOCK_OWNER_SEARCH_TASKS.find((task) => task.id === id);
}

export function countOpenOwnerSearchTasks(): number {
  return MOCK_OWNER_SEARCH_TASKS.filter((task) => task.status !== "wrong_number").length;
}
