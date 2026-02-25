export type SessionUser = {
  id: number;
  name: string;
  email: string;
  isAdmin: boolean;
  isProtectedAdmin: boolean;
};

export type DashboardData = {
  mediaCount: number;
  borrowerCount: number;
  userCount: number;
  activeLoanCount: number;
  overdueLoanCount: number;
};

export type MediaListItem = {
  id: number;
  title: string;
  mediaType: string;
  creator: string | null;
  publicationYear: number | null;
  barcode: string | null;
  notes: string | null;
  totalCopies: number;
  availableCopies: number;
  createdAt: string;
  updatedAt: string;
};

export type MediaFormValue = {
  id: number;
  title: string;
  mediaType: string;
  creator: string;
  publicationYear: number | null;
  barcode: string;
  notes: string;
  totalCopies: number;
};

export type Borrower = {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type BorrowerFormValue = {
  id: number;
  name: string;
  email: string;
  phone: string;
  notes: string;
};

export type ActiveLoan = {
  id: number;
  mediaId: number;
  mediaTitle: string;
  mediaBarcode: string | null;
  borrowerId: number;
  borrowerName: string;
  checkedOutAt: string;
  dueAt: string | null;
  checkedInAt: string | null;
  notes: string | null;
};

export type UserListItem = {
  id: number;
  name: string;
  email: string;
  isAdmin: boolean;
  isProtectedAdmin: boolean;
  createdAt: string;
  updatedAt: string;
};

export type MediaCheckoutOption = {
  id: number;
  title: string;
  barcode: string | null;
  availableCopies: number;
};

export type BorrowerOption = {
  id: number;
  name: string;
};
