// RewardPointsPage.jsx

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
import { useLoaderData } from "@remix-run/react";
import { apiVersion, authenticate } from "../shopify.server";
import "../styles/reward-points.css";

// GraphQL query để lấy thông tin chi tiết về khách hàng
export const query = `
{
  customers(first: 10) {
    edges {
      node {
        id
        firstName
        lastName
        phone
        email
        addresses {
          country
        }
        orders(first: 10) {
          nodes {
            name
          }
        }
        amountSpent {
          amount
          currencyCode
        }
      }
    }
  }
}
`;

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const { shop, accessToken } = session;

  try {
    const response = await fetch(
      `https://${shop}/admin/api/${apiVersion}/graphql.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": accessToken,
        },
        body: JSON.stringify({ query }),
      },
    );

    const result = await response.json();
    if (result.errors) {
      console.error("GraphQL Error:", result.errors);
      throw new Error(result.errors[0]?.message || "GraphQL query failed");
    }

    if (!result?.data?.customers) {
      throw new Error("No customers data found in response.");
    }

    return result.data.customers.edges.map(({ node }) => ({
      id: node.id,
      name: `${node.firstName ?? ""} ${node.lastName ?? ""}` ?? "N/A",
      email: node.email ?? "N/A",
      phone: node.phone ?? "N/A",
      address: node.addresses.map((addr) => `${addr.country}`).join("; ") ?? "N/A",
      orders: node.orders.nodes.map((order) => order.name).join(", ") ?? "N/A",
      amountSpent: `${node.amountSpent.amount} ${node.amountSpent.currencyCode}` ?? "N/A",
      points: 0,
    }));
  } catch (error) {
    console.error("Error fetching customers:", error);
    throw new Response("Failed to load customers", { status: 500 });
  }
};

function RewardPointsPage() {
  const customersData = useLoaderData();
  const [customers, setCustomers] = useState(customersData);
  const [editPoints, setEditPoints] = useState({});
  const [multiEditPoints, setMultiEditPoints] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  const [showToast, setShowToast] = useState(false);

  const { selectedResources, allResourcesSelected, handleSelectionChange } =
    useIndexResourceState(customers);

  const handleEditPoints = useCallback((id, newPoints) => {
    setCustomers((prev) =>
      prev.map((customer) =>
        customer.id === id ? { ...customer, points: newPoints } : customer,
      ),
    );
    setSelectedCustomerId(null);
  }, []);

  const handleMultiEdit = useCallback(() => {
    setCustomers((prev) =>
      prev.map((customer) =>
        selectedResources.includes(customer.id)
          ? { ...customer, points: parseInt(multiEditPoints, 10) || 0 }
          : customer,
      ),
    );
    setMultiEditPoints("");
    setShowToast(true);
  }, [multiEditPoints, selectedResources]);

  const renderEditForm = (id, currentPoints) => (
    <Layout.Section>
      <TextField
        label="Reward Points"
        type="number"
        value={editPoints[id] || currentPoints.toString()}
        onChange={(value) => setEditPoints({ ...editPoints, [id]: value })}
      />
      <Button
        onClick={() =>
          handleEditPoints(id, parseInt(editPoints[id] || currentPoints, 10))
        }
      >
        Save
      </Button>
      <Button onClick={() => setSelectedCustomerId(null)} plain>
        Cancel
      </Button>
    </Layout.Section>
  );

  const rowMarkup = customers.map(
    (
      {
        id,
        name,
        email,
        phone,
        address,
        orders,
        orderCount,
        amountSpent,
        points,
      },
      index, // index để tạo ID tự động tang
    ) => (
      <IndexTable.Row
        id={id}
        key={id}
        selected={selectedResources.includes(id)}
      >
        <IndexTable.Cell>{index + 1}</IndexTable.Cell> {/* Hiển thị STT */}
        <IndexTable.Cell>
          <Badge>{name}</Badge>
        </IndexTable.Cell>
        <IndexTable.Cell>{email}</IndexTable.Cell>
        <IndexTable.Cell>{phone}</IndexTable.Cell>
        <IndexTable.Cell>{address}</IndexTable.Cell>
        <IndexTable.Cell>{orders}</IndexTable.Cell>
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
                { title: "Orders" },
                { title: "Amount Spent" },
                { title: "Reward Points" },
                { title: "Actions" },
              ]}
            >
              {rowMarkup}
            </IndexTable>
          </LegacyCard>
        </Card>

        {showToast && (
          <Toast
            content="Points updated successfully"
            onDismiss={() => setShowToast(false)}
          />
        )}
      </Page>
    </Frame>
  );
}

export default RewardPointsPage;
