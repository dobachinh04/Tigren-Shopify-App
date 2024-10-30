import React, { useState, useCallback, useEffect } from "react";
import {
  Page,
  Card,
  IndexTable,
  TextField,
  Button,
  Layout,
  Frame,
  Toast,
  useIndexResourceState,
  LegacyCard,
  Badge,
} from "@shopify/polaris";
import { json } from "@remix-run/node";
import { useFetcher, useLoaderData } from "@remix-run/react";
import {
  fetchCustomerData,
  updateCustomerRewardPoints,
} from "../server/reward-points.server";
import "../styles/reward-points.css";

export const loader = async ({ request }) => {
  try {
    const customers = await fetchCustomerData(request);
    return json(customers);
  } catch (error) {
    console.error("Error fetching customers:", error);
    throw new Response("Failed to load customers", { status: 500 });
  }
};

export const action = async ({ request }) => {
  const formData = await request.formData();
  const isMultiEdit = formData.get("isMultiEdit") === "true";
  const points = parseInt(formData.get("points"), 10);

  try {
    if (isMultiEdit) {
      const customerIds = JSON.parse(formData.get("customerIds"));
      await Promise.all(
        customerIds.map((customerId) =>
          updateCustomerRewardPoints(request, customerId, points),
        ),
      );
      return json({ success: true, multiEdit: true });
    } else {
      const customerId = formData.get("customerId");
      await updateCustomerRewardPoints(request, customerId, points);
      return json({ success: true });
    }
  } catch (error) {
    console.error("Error updating reward points:", error);
    return json({ success: false, message: error.message }, { status: 500 });
  }
};

function RewardPointsPage() {
  const customersData = useLoaderData();
  const fetcher = useFetcher();
  const [customers, setCustomers] = useState(customersData);
  const [editPoints, setEditPoints] = useState({});
  const [multiEditPoints, setMultiEditPoints] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const { selectedResources, allResourcesSelected, handleSelectionChange } =
    useIndexResourceState(customers);

  const validatePoints = (value) => {
    const parsedValue = parseInt(value, 10);
    return (
      !isNaN(parsedValue) && parsedValue > -1 && Number.isInteger(parsedValue)
    );
  };

  const handleEditPoints = (id, currentPoints) => {
    if (!validatePoints(editPoints[id])) {
      setToastMessage("Invalid input. Only positive integers are allowed.");
      setShowToast(true);
      return;
    }

    fetcher.submit(
      {
        customerId: id,
        points: editPoints[id],
      },
      { method: "post" },
    );

    setCustomers((prevCustomers) =>
      prevCustomers.map((customer) =>
        customer.id === id
          ? {
              ...customer,
              points: parseInt(editPoints[id], 10) || currentPoints,
            }
          : customer,
      ),
    );

    setToastMessage("Points updated successfully!");
    setShowToast(true);
    setSelectedCustomerId(null);
  };

  const handleMultiEdit = useCallback(() => {
    if (!validatePoints(multiEditPoints)) {
      setToastMessage("Invalid input. Only positive integers are allowed.");
      setShowToast(true);
      return;
    }

    const customerIds = JSON.stringify(selectedResources);
    const points = parseInt(multiEditPoints, 10);

    fetcher.submit(
      {
        isMultiEdit: "true",
        customerIds,
        points,
      },
      { method: "post", replace: true },
    );

    setCustomers((prevCustomers) =>
      prevCustomers.map((customer) =>
        selectedResources.includes(customer.id)
          ? { ...customer, points }
          : customer,
      ),
    );

    setToastMessage("Points updated successfully for selected customers.");
    setShowToast(true);
    setMultiEditPoints("");
  }, [multiEditPoints, selectedResources]);

  const renderEditForm = (id, currentPoints) => (
    <Layout.Section>
      <TextField
        label="Reward Points"
        type="number"
        value={editPoints[id] || currentPoints.toString()}
        onChange={(value) => setEditPoints({ ...editPoints, [id]: value })}
      />
      <Button onClick={() => handleEditPoints(id, currentPoints)}>Save</Button>
      <Button onClick={() => setSelectedCustomerId(null)} plain>
        Cancel
      </Button>
    </Layout.Section>
  );

  const filteredCustomers = customers.filter((customer) =>
    customer.name.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const paginatedCustomers = filteredCustomers.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  const totalPages = Math.ceil(filteredCustomers.length / itemsPerPage);

  const rowMarkup = paginatedCustomers.map(
    (
      { id, name, email, phone, address, orderCount, amountSpent, points },
      index,
    ) => (
      <IndexTable.Row
        id={id}
        key={id}
        selected={selectedResources.includes(id)}
      >
        <IndexTable.Cell>
          {(currentPage - 1) * itemsPerPage + index + 1}
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Badge>{name}</Badge>
        </IndexTable.Cell>
        <IndexTable.Cell>{email}</IndexTable.Cell>
        <IndexTable.Cell>{phone}</IndexTable.Cell>
        <IndexTable.Cell>{address}</IndexTable.Cell>
        <IndexTable.Cell>{orderCount}</IndexTable.Cell>
        <IndexTable.Cell>{points}</IndexTable.Cell>
        <IndexTable.Cell>
          {selectedCustomerId === id ? (
            renderEditForm(id, points)
          ) : (
            <Button onClick={() => setSelectedCustomerId(id)}>Edit</Button>
          )}
        </IndexTable.Cell>
      </IndexTable.Row>
    ),
  );

  return (
    <Frame>
      <Page fullWidth title="Customers Reward Points">
        <Card sectioned>
          <Layout>
            <Layout.Section>
              <div className="multi-edit-form">
                <TextField
                  label="Multi Edit Reward Points"
                  type="number"
                  value={multiEditPoints}
                  onChange={(value) => setMultiEditPoints(value)}
                  placeholder="Enter points to set"
                />
              </div>
              <Button
                onClick={handleMultiEdit}
                disabled={selectedResources.length === 0}
                primary
                style={{ marginTop: "10px" }}
              >
                Apply to Selected
              </Button>
            </Layout.Section>
          </Layout>
        </Card>

        <Card>
          <div className="search-bar-container">
            <TextField
              label="Search Customers"
              value={searchTerm}
              onChange={(value) => setSearchTerm(value)}
              placeholder="Search by name"
              className="search-bar"
            />
          </div>
          <LegacyCard>
            <IndexTable
              resourceName={{ singular: "customer", plural: "customers" }}
              itemCount={filteredCustomers.length}
              selectedItemsCount={
                allResourcesSelected ? "All" : selectedResources.length
              }
              onSelectionChange={handleSelectionChange}
              headings={[
                { title: "ID" },
                { title: "Customer Name" },
                { title: "Email" },
                { title: "Phone" },
                { title: "Address" },
                { title: "Total Orders" },
                { title: "Reward Points" },
                { title: "Action" },
              ]}
            >
              {rowMarkup}
            </IndexTable>
          </LegacyCard>

          <div className="pagination-container">
            <button
              className="pagination-button"
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
            >
              Previous
            </button>
            <span className="pagination-info">
              Page {currentPage} of {totalPages}
            </span>
            <button
              className="pagination-button"
              onClick={() =>
                setCurrentPage((prev) => Math.min(prev + 1, totalPages))
              }
              disabled={currentPage === totalPages}
            >
              Next
            </button>
          </div>
        </Card>

        {showToast && (
          <Toast content={toastMessage} onDismiss={() => setShowToast(false)} />
        )}
      </Page>
    </Frame>
  );
}

export default RewardPointsPage;
