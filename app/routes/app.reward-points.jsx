import React, { useState, useCallback } from "react";
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
  const customerId = formData.get("customerId");
  const points = parseInt(formData.get("points"), 10);

  try {
    await updateCustomerRewardPoints(request, customerId, points);
    return json({ success: true });
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

  const { selectedResources, allResourcesSelected, handleSelectionChange } =
    useIndexResourceState(customers);

  const handleEditPoints = async (id, currentPoints) => {
    try {
      const response = await fetcher.submit(
        {
          customerId: id,
          points: editPoints[id] || currentPoints,
        },
        { method: "post" },
      );

      // Kiểm tra kết quả cập nhật từ fetcher
      const result = await response.json();

      if (result.success) {
        // Làm mới dữ liệu khách hàng từ server để đảm bảo đồng bộ với Shopify
        const updatedCustomers = await fetcher.load("/app/reward-points");
        setCustomers(updatedCustomers);

        setToastMessage("Points updated successfully!");
      } else {
        setToastMessage("Failed to update points.");
      }
    } catch (error) {
      console.error("Error updating points:", error);
      setToastMessage("An error occurred while updating points.");
    } finally {
      setSelectedCustomerId(null);
      setShowToast(true);
    }
  };

  const handleMultiEdit = useCallback(async () => {
    try {
      const updates = selectedResources.map((id) => ({
        customerId: id,
        points: parseInt(multiEditPoints, 10) || 0,
      }));

      await Promise.all(
        updates.map(({ customerId, points }) =>
          fetcher.submit(
            { customerId, points },
            { method: "post", replace: true },
          ),
        ),
      );

      setCustomers((prev) =>
        prev.map((customer) =>
          selectedResources.includes(customer.id)
            ? { ...customer, points: parseInt(multiEditPoints, 10) || 0 }
            : customer,
        ),
      );

      setToastMessage("Points updated successfully for selected customers.");
    } catch (error) {
      console.error("Error updating points:", error);
      setToastMessage("Failed to update points for selected customers.");
    } finally {
      setMultiEditPoints("");
      setShowToast(true);
    }
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

  const rowMarkup = customers.map(
    (
      { id, name, email, phone, address, orderCount, amountSpent, points },
      index,
    ) => (
      <IndexTable.Row
        id={id}
        key={id}
        selected={selectedResources.includes(id)}
      >
        <IndexTable.Cell>{index + 1}</IndexTable.Cell>
        <IndexTable.Cell>
          <Badge>{name}</Badge>
        </IndexTable.Cell>
        <IndexTable.Cell>{email}</IndexTable.Cell>
        <IndexTable.Cell>{phone}</IndexTable.Cell>
        <IndexTable.Cell>{address}</IndexTable.Cell>
        <IndexTable.Cell>{orderCount}</IndexTable.Cell>
        <IndexTable.Cell>{amountSpent}</IndexTable.Cell>
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
              <TextField
                label="Multi Edit Reward Points"
                type="number"
                value={multiEditPoints}
                onChange={(value) => setMultiEditPoints(value)}
                placeholder="Enter points to set"
              />
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
          <LegacyCard>
            <IndexTable
              resourceName={{ singular: "customer", plural: "customers" }}
              itemCount={customers.length}
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
                { title: "Amount Spent" },
                { title: "Reward Points" },
                { title: "Action" },
              ]}
            >
              {rowMarkup}
            </IndexTable>
          </LegacyCard>
        </Card>

        {showToast && (
          <Toast content={toastMessage} onDismiss={() => setShowToast(false)} />
        )}
      </Page>
    </Frame>
  );
}

export default RewardPointsPage;
